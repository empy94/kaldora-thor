package eu.kaldorathor;

import android.app.Activity;
import android.os.Bundle;
import android.os.SystemClock;
import android.view.InputDevice;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.webkit.WebView;
import org.json.JSONObject;

public final class Companion extends Activity {
    private WebView panel;
    private final java.util.concurrent.ExecutorService motion =
        java.util.concurrent.Executors.newSingleThreadExecutor();
    private final java.util.concurrent.atomic.AtomicReference<String> latestDirection =
        new java.util.concurrent.atomic.AtomicReference<>();
    private final java.util.concurrent.atomic.AtomicBoolean motionPending =
        new java.util.concurrent.atomic.AtomicBoolean();
    private String previousDirection = "";
    private long lastMotion;
    private int previousHatX, previousHatY;
    private final android.os.Handler motionHeartbeat = new android.os.Handler(android.os.Looper.getMainLooper());
    private boolean motionActive;
    private int motionDeviceId = -1;
    private final Runnable repeatMotion = new Runnable() {
        @Override public void run() {
            if (!motionActive || !visible || !hasWindowFocus()) return;
            // A disconnected controller must not leave movement held indefinitely.
            if (motionDeviceId >= 0 && InputDevice.getDevice(motionDeviceId) == null) {
                stopMotion();
                return;
            }
            sendMotion(previousDirection);
            motionHeartbeat.postDelayed(this, 150);
        }
    };

    private void stopMotion() {
        motionActive = false;
        motionDeviceId = -1;
        motionHeartbeat.removeCallbacks(repeatMotion);
        previousDirection = "";
        sendMotion("{\"dir\":[],\"camera\":[0,0]}");
    }

    private void sendMotion(String direction) {
        latestDirection.set(direction);
        flushMotion();
    }

    private void flushMotion() {
        if (motion.isShutdown() || !motionPending.compareAndSet(false, true)) return;
        motion.execute(() -> {
            try {
                String direction;
                while (!motion.isShutdown() && (direction = latestDirection.getAndSet(null)) != null)
                    post("{\"type\":\"move\",\"value\":" + direction + "}");
            } finally {
                motionPending.set(false);
                if (latestDirection.get() != null) flushMotion();
            }
        });
    }
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
                request = (java.net.HttpURLConnection)new java.net.URL("http://127.0.0.1:49227/action").openConnection();
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
        stopMotion();
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
                new java.net.URL("http://127.0.0.1:49227/game").openConnection();
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
        android.widget.FrameLayout root = new android.widget.FrameLayout(this);
        root.addView(panel, new android.widget.FrameLayout.LayoutParams(-1, -1));
        getWindow().setSoftInputMode(android.view.WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE);
        if (android.os.Build.VERSION.SDK_INT >= 30) {
            root.setOnApplyWindowInsetsListener((view, insets) -> {
                int ime = insets.getInsets(android.view.WindowInsets.Type.ime()).bottom;
                android.widget.FrameLayout.LayoutParams params = (android.widget.FrameLayout.LayoutParams) panel.getLayoutParams();
                if (params.bottomMargin != ime) {
                    params.bottomMargin = ime;
                    panel.setLayoutParams(params);
                    panel.evaluateJavascript("document.body?.classList.toggle('keyboard-open'," + (ime > 0) + ")", null);
                }
                return view.onApplyWindowInsets(insets);
            });
        }
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
        setContentView(root);
        panel.loadUrl("file:///android_asset/panel.html");
        bridgeToken = ConnectionKey.get(this);
        updates.scheduleWithFixedDelay(this::readGame, 600, 700, java.util.concurrent.TimeUnit.MILLISECONDS);
    }

    @Override public boolean dispatchKeyEvent(KeyEvent event) {
        int source = event.getSource();
        if ((source & InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD
                || (source & InputDevice.SOURCE_DPAD) == InputDevice.SOURCE_DPAD) {
            String key = KeyEvent.keyCodeToString(event.getKeyCode()).replace("KEYCODE_", "");
            if (event.getAction() == KeyEvent.ACTION_DOWN && event.getRepeatCount() == 0) sendPadKey(key);
            if (event.getAction() == KeyEvent.ACTION_UP) releasePadKey(key);
            if (event.getKeyCode() != KeyEvent.KEYCODE_BACK) return true;
        }
        return super.dispatchKeyEvent(event);
    }

    private void sendPadKey(String key) {
        panel.evaluateJavascript("window.padKey?.(" + JSONObject.quote(key) + ")", null);
    }

    private void releasePadKey(String key) {
        panel.evaluateJavascript("window.padRelease?.(" + JSONObject.quote(key) + ")", null);
    }

    @Override public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (!hasFocus && panel != null) {
            previousHatX = previousHatY = 0;
            stopMotion();
            panel.evaluateJavascript("window.resetPad?.()", null);
        }
    }

    @Override public boolean dispatchGenericMotionEvent(MotionEvent event) {
        if (event.isFromSource(InputDevice.SOURCE_JOYSTICK)) {
            long now = SystemClock.uptimeMillis();
            int hatX = Math.round(event.getAxisValue(MotionEvent.AXIS_HAT_X));
            int hatY = Math.round(event.getAxisValue(MotionEvent.AXIS_HAT_Y));
            if (previousHatX != 0 && previousHatX != hatX) releasePadKey(previousHatX < 0 ? "DPAD_LEFT" : "DPAD_RIGHT");
            if (previousHatY != 0 && previousHatY != hatY) releasePadKey(previousHatY < 0 ? "DPAD_UP" : "DPAD_DOWN");
            if (hatX != 0 && hatX != previousHatX) sendPadKey(hatX < 0 ? "DPAD_LEFT" : "DPAD_RIGHT");
            if (hatY != 0 && hatY != previousHatY) sendPadKey(hatY < 0 ? "DPAD_UP" : "DPAD_DOWN");
            previousHatX = hatX;
            previousHatY = hatY;
            float x = event.getAxisValue(MotionEvent.AXIS_X);
            float y = event.getAxisValue(MotionEvent.AXIS_Y);
            org.json.JSONArray direction = new org.json.JSONArray();
            if (x < -.38f) direction.put("A");
            if (x > .38f) direction.put("D");
            if (y < -.38f) direction.put("W");
            if (y > .38f) direction.put("S");
            float cameraX = event.getAxisValue(MotionEvent.AXIS_Z);
            float cameraY = event.getAxisValue(MotionEvent.AXIS_RZ);
            org.json.JSONArray camera = new org.json.JSONArray();
            org.json.JSONObject input = new org.json.JSONObject();
            try {
                camera.put((double) cameraX);
                camera.put((double) cameraY);
                input.put("dir", direction);
                input.put("camera", camera);
            } catch (org.json.JSONException ignored) {
                return true;
            }
            String value = input.toString();
            boolean moving = direction.length() > 0 || Math.hypot(cameraX, cameraY) > .12;
            if (moving && !motionActive) {
                motionActive = true;
                motionDeviceId = event.getDeviceId();
                motionHeartbeat.removeCallbacks(repeatMotion);
                motionHeartbeat.postDelayed(repeatMotion, 150);
            } else if (!moving && motionActive) {
                motionActive = false;
                motionDeviceId = -1;
                motionHeartbeat.removeCallbacks(repeatMotion);
            }
            if (!value.equals(previousDirection) || (moving && now - lastMotion > 45)) {
                previousDirection = value;
                lastMotion = now;
                sendMotion(value);
            }
            return true;
        }
        return super.dispatchGenericMotionEvent(event);
    }

    @Override protected void onDestroy() {
        motionHeartbeat.removeCallbacks(repeatMotion);
        motion.shutdownNow();
        updates.shutdownNow();
        panel.destroy();
        super.onDestroy();
    }
}
