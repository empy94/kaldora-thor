package eu.kaldorathor;

import android.content.Context;
import java.security.SecureRandom;
import java.util.Locale;

final class ConnectionKey {
    private ConnectionKey() {}

    static synchronized String get(Context context) {
        android.content.SharedPreferences prefs = context.getSharedPreferences("connection", Context.MODE_PRIVATE);
        String key = prefs.getString("token", null);
        if (valid(key)) return key.toLowerCase(Locale.ROOT);
        byte[] bytes = new byte[32];
        new SecureRandom().nextBytes(bytes);
        StringBuilder text = new StringBuilder(64);
        for (byte b : bytes) text.append(String.format(Locale.ROOT, "%02x", b & 0xff));
        key = text.toString();
        key = key.toLowerCase(Locale.ROOT);
        if (!prefs.edit().putString("token", key).commit()) throw new IllegalStateException("Cannot save connection key");
        return key;
    }
    private static boolean valid(String key) { return key != null && key.matches("[0-9a-fA-F]{64}"); }
}
