package eu.kaldorathor;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import org.json.JSONObject;

public final class Companion extends Activity {
    private WebView panel;
    private final java.util.concurrent.ScheduledExecutorService updates =
        java.util.concurrent.Executors.newSingleThreadScheduledExecutor();
    private volatile boolean visible;
    private String bridgeToken;

    private void sendAction(String json) {
        if (bridgeToken == null || json == null || json.length() > 4096 || updates.isShutdown()) return;
        updates.execute(() -> {
            final boolean accepted = post(json);
            runOnUiThread(() -> {
                if (!isDestroyed()) panel.evaluateJavascript("window.actionResult?.(" + accepted + ")",null);
            });
        });
    }

    private boolean post(String json) {
            if (bridgeToken == null) return false;
            boolean ok = false;
            java.net.HttpURLConnection request = null;
            try {
                request = (java.net.HttpURLConnection)new java.net.URL("http://127.0.0.1:49226/action").openConnection();
                request.setInstanceFollowRedirects(false);
                request.setConnectTimeout(1200);
                request.setReadTimeout(3000);
                request.setRequestMethod("POST");
                request.setRequestProperty("Authorization", "Bearer " + bridgeToken);
                request.setRequestProperty("Content-Type", "application/json");
                request.setDoOutput(true);
                try (java.io.OutputStream stream = request.getOutputStream()) {
                    stream.write(json.getBytes(java.nio.charset.StandardCharsets.UTF_8));
                }
                try (java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.InputStreamReader(request.getInputStream(),"UTF-8"))) {
                    ok = new JSONObject(reader.readLine()).optBoolean("ok");
                }
            } catch (Exception ignored) {
            } finally {
                if (request != null) request.disconnect();
            }
            return ok;
    }

    @Override protected void onStart() {
        super.onStart();
        visible = true;
    }

    @Override protected void onStop() {
        visible = false;
        super.onStop();
    }

    private void readGame() {
        String token = bridgeToken;
        if (!visible) return;
        String snapshot = "{\"online\":false}";
        java.net.HttpURLConnection connection = null;
        try {
            if (token == null || token.isEmpty()) throw new java.io.IOException("Connection not configured");
            connection = (java.net.HttpURLConnection)
                new java.net.URL("http://127.0.0.1:49226/game").openConnection();
            connection.setInstanceFollowRedirects(false);
            connection.setConnectTimeout(800);
            connection.setReadTimeout(1600);
            connection.setRequestProperty("Authorization", "Bearer " + token);
            try (java.io.BufferedReader reader = new java.io.BufferedReader(
                    new java.io.InputStreamReader(connection.getInputStream(), "UTF-8"))) {
                snapshot = new JSONObject(reader.readLine()).toString();
            }
        } catch (Exception ignored) {
        } finally {
            if (connection != null) connection.disconnect();
        }
        final String data = JSONObject.quote(snapshot);
        runOnUiThread(() -> {
            if (visible && !isDestroyed())
                panel.evaluateJavascript("window.renderGame?.(JSON.parse(" + data + "))", null);
        });
    }

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().getDecorView().setSystemUiVisibility(5894 | 1024 | 512);
        panel = new WebView(this);
        panel.setBackgroundColor(0xff0c141e);
        panel.getSettings().setJavaScriptEnabled(true);
        panel.getSettings().setDomStorageEnabled(true);
        panel.setWebViewClient(new android.webkit.WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, android.webkit.WebResourceRequest request) {
                android.net.Uri uri = request.getUrl();
                if (request.isForMainFrame() && "kaldorathor".equals(uri.getScheme()) && "action".equals(uri.getHost())) {
                    sendAction(uri.getQueryParameter("data"));
                }
                return true;
            }
        });
        setContentView(panel);
        panel.loadUrl("file:///android_asset/panel.html");
        bridgeToken = ConnectionKey.get(this);
        updates.scheduleWithFixedDelay(this::readGame, 600, 700, java.util.concurrent.TimeUnit.MILLISECONDS);
    }

    @Override protected void onDestroy() {
        updates.shutdownNow();
        panel.destroy();
        super.onDestroy();
    }
}
