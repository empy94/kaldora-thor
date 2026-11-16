package eu.kaldorathor;

import java.io.BufferedInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.RejectedExecutionException;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import org.json.JSONObject;

final class LocalBridge {
    private static LocalBridge instance;
    private static final int PORT = 49227;
    private final byte[] authorization;
    private final ServerSocket server;
    private final AtomicLong sequence = new AtomicLong();
    private final ArrayBlockingQueue<Command> commands = new ArrayBlockingQueue<>(8);
    private final ConcurrentHashMap<String, Command> pending = new ConcurrentHashMap<>();
    private final ThreadPoolExecutor workers = new ThreadPoolExecutor(6, 6, 0, TimeUnit.SECONDS,
            new ArrayBlockingQueue<>(8));
    private volatile String snapshot = "{\"online\":false}";
    private volatile long lastExchange;

    private static final class Command {
        final JSONObject action;
        final String id;
        final CountDownLatch done = new CountDownLatch(1);
        volatile boolean ok;

        Command(JSONObject action, String id) {
            this.action = action;
            this.id = id;
        }
    }

    static synchronized void start(String token) throws IOException {
        if (instance == null) instance = new LocalBridge(token);
    }

    private LocalBridge(String token) throws IOException {
        authorization = ("Bearer " + token).getBytes(StandardCharsets.US_ASCII);
        server = new ServerSocket(PORT, 12, InetAddress.getByName("127.0.0.1"));
        new Thread(this::accept, "Kaldora local bridge").start();
    }

    private void accept() {
        while (!server.isClosed()) {
            try {
                Socket client = server.accept();
                try { workers.execute(() -> handle(client)); }
                catch (RejectedExecutionException busy) { client.close(); }
            } catch (IOException interrupted) { return; }
        }
    }

    private void handle(Socket client) {
        try (Socket socket = client) {
            socket.setSoTimeout(1800);
            BufferedInputStream input = new BufferedInputStream(socket.getInputStream());
            String[] request = readLine(input).split(" ");
            if (request.length != 3) return;
            int length = 0;
            boolean authorized = false;
            for (int i = 0; ; i++) {
                if (i >= 32) return;
                String header = readLine(input);
                if (header.isEmpty()) break;
                int split = header.indexOf(':');
                if (split <= 0) return;
                String name = header.substring(0, split);
                String value = header.substring(split + 1).trim();
                if ("Authorization".equalsIgnoreCase(name))
                    authorized = MessageDigest.isEqual(authorization, value.getBytes(StandardCharsets.US_ASCII));
                if ("Content-Length".equalsIgnoreCase(name)) length = Integer.parseInt(value);
                if ("Transfer-Encoding".equalsIgnoreCase(name)) return;
            }
            if (!authorized) { respond(socket, 404, "{}"); return; }
            if ("GET".equals(request[0]) && "/game".equals(request[1])) {
                respond(socket, 200, live() ? snapshot : "{\"online\":false}");
                return;
            }
            if (!"POST".equals(request[0]) || length <= 0) return;
            String path = request[1];
            if (!"/snapshot".equals(path) && !"/commands".equals(path) && !"/action".equals(path)) return;
            if (length > ("/snapshot".equals(path) ? 600_000 : 16_384)) return;
            byte[] body = new byte[length];
            for (int offset = 0; offset < length;) {
                int count = input.read(body, offset, length - offset);
                if (count < 0) return;
                offset += count;
            }
            JSONObject payload = new JSONObject(new String(body, StandardCharsets.UTF_8));
            if ("/snapshot".equals(path)) {
                JSONObject state = payload.optJSONObject("snapshot");
                snapshot = state == null ? "{\"online\":false}" : state.toString();
                lastExchange = System.nanoTime();
                respond(socket, 200, "{}");
            } else if ("/commands".equals(path)) {
                respond(socket, 200, nextCommand(payload));
            } else {
                respond(socket, 200, submit(payload));
            }
        } catch (Exception ignored) { }
    }

    private boolean live() {
        return lastExchange != 0 && System.nanoTime() - lastExchange < TimeUnit.SECONDS.toNanos(3);
    }

    private String nextCommand(JSONObject payload) throws org.json.JSONException, InterruptedException {
        JSONObject completed = payload.optJSONObject("completed");
        if (completed != null) {
            Command command = pending.get(completed.optString("id"));
            if (command != null) {
                command.ok = Boolean.TRUE.equals(completed.opt("ok"));
                command.done.countDown();
            }
        }
        long deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(650);
        Command next;
        while ((next = commands.poll(Math.max(0, deadline - System.nanoTime()), TimeUnit.NANOSECONDS)) != null) {
            if (pending.containsKey(next.id))
                return new JSONObject().put("id", next.id).put("action", next.action).toString();
        }
        return "{}";
    }

    private String submit(JSONObject action) throws InterruptedException {
        if (!live()) return "{\"ok\":false}";
        Command command = new Command(action, Long.toString(sequence.incrementAndGet()));
        pending.put(command.id, command);
        try {
            if (!commands.offer(command)) return "{\"ok\":false}";
            return command.done.await(1400, TimeUnit.MILLISECONDS) && command.ok
                    ? "{\"ok\":true}" : "{\"ok\":false}";
        } finally {
            pending.remove(command.id);
            commands.remove(command);
        }
    }

    private static String readLine(BufferedInputStream input) throws IOException {
        ByteArrayOutputStream line = new ByteArrayOutputStream();
        while (line.size() < 2048) {
            int next = input.read();
            if (next < 0) break;
            if (next == '\n') return new String(line.toByteArray(), StandardCharsets.US_ASCII).trim();
            line.write(next);
        }
        throw new IOException("Incomplete HTTP header");
    }

    private static void respond(Socket socket, int status, String json) throws IOException {
        byte[] body = json.getBytes(StandardCharsets.UTF_8);
        String header = "HTTP/1.1 " + (status == 200 ? "200 OK" : "404 Not Found")
                + "\r\nContent-Type: application/json\r\nCache-Control: no-store\r\nContent-Length: "
                + body.length + "\r\nConnection: close\r\n\r\n";
        socket.getOutputStream().write(header.getBytes(StandardCharsets.US_ASCII));
        socket.getOutputStream().write(body);
    }
}
