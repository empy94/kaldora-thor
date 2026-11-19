package eu.kaldorathor;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.Settings;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.util.Arrays;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import javax.net.ssl.HttpsURLConnection;

final class ReleaseUpdater {
    static final int INSTALL_PERMISSION_REQUEST = 72;
    static final String APK_NAME = "Kaldora-Thor-Release.apk";
    private static final String REPO = "empy94/kaldora-thor";
    private static final String LATEST = "https://api.github.com/repos/" + REPO + "/releases/latest";
    private static final Pattern TAG = Pattern.compile("v(\\d{1,6}\\.\\d{1,6}\\.\\d{1,6})(?:-firefox-\\d{1,6}\\.\\d{1,6}\\.\\d{1,6})?");
    private static final long CHECK_INTERVAL = 6 * 60 * 60 * 1000L;
    private static final long MAX_APK_BYTES = 32 * 1024 * 1024L;

    static void check(Activity activity, Runnable play) {
        PackageInfo installed;
        try {
            installed = activity.getPackageManager().getPackageInfo(activity.getPackageName(), 0);
        } catch (PackageManager.NameNotFoundException unavailable) {
            play.run();
            return;
        }
        SharedPreferences prefs = activity.getSharedPreferences("github_updates", Activity.MODE_PRIVATE);
        Offer cached = Offer.read(prefs.getString("offer", ""), installed.versionName);
        long age = System.currentTimeMillis() - prefs.getLong("checked", 0);
        if (age >= 0 && age < CHECK_INTERVAL) {
            if (cached == null) play.run();
            else showOffer(activity, prefs, cached, play);
            return;
        }

        Handler main = new Handler(Looper.getMainLooper());
        boolean[] timedOut = {false};
        Runnable timeout = () -> {
            timedOut[0] = true;
            if (!activity.isFinishing() && !activity.isDestroyed()) play.run();
        };
        main.postDelayed(timeout, 1500);
        new Thread(() -> {
            Offer offer = null;
            try {
                String response = fetchLatest();
                offer = Offer.read(response, installed.versionName);
                prefs.edit().putLong("checked", System.currentTimeMillis())
                    .putString("offer", offer == null ? "" : response).apply();
            } catch (Exception unavailable) {
                // The game is still usable if GitHub is offline or rate-limited.
            }
            Offer latest = offer;
            main.post(() -> {
                main.removeCallbacks(timeout);
                if (timedOut[0] || activity.isFinishing() || activity.isDestroyed()) return;
                if (latest == null) play.run();
                else showOffer(activity, prefs, latest, play);
            });
        }, "Check GitHub release").start();
    }

    private static String fetchLatest() throws Exception {
        HttpsURLConnection connection = connect(LATEST);
        connection.setRequestProperty("Accept", "application/vnd.github+json");
        try (InputStream input = connection.getInputStream();
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            copy(input, output, 256 * 1024, null);
            return new String(output.toByteArray(), StandardCharsets.UTF_8);
        } finally {
            connection.disconnect();
        }
    }

    private static void showOffer(Activity activity, SharedPreferences prefs, Offer offer, Runnable play) {
        Runnable later = () -> {
            prefs.edit().remove("offer").apply();
            play.run();
        };
        new AlertDialog.Builder(activity)
            .setTitle("Kaldora Thor " + offer.version + " available")
            .setMessage("Download the update from GitHub? Android will ask you to confirm installation.")
            .setPositiveButton("Update", (dialog, choice) -> prepare(activity, offer, play))
            .setNegativeButton("Later", (dialog, choice) -> later.run())
            .setOnCancelListener(dialog -> later.run())
            .show();
    }

    private static void prepare(Activity activity, Offer offer, Runnable play) {
        AlertDialog progress = new AlertDialog.Builder(activity)
            .setTitle("Downloading update")
            .setMessage("Verifying the APK from GitHub…")
            .setNegativeButton("Play now", (dialog, choice) -> play.run())
            .setOnCancelListener(dialog -> play.run())
            .show();
        new Thread(() -> {
            try {
                downloadAndVerify(activity, offer);
                activity.runOnUiThread(() -> {
                    if (!progress.isShowing() || activity.isFinishing() || activity.isDestroyed()) return;
                    progress.dismiss();
                    if (activity.getPackageManager().canRequestPackageInstalls()) {
                        if (!openInstaller(activity)) showFailure(activity, play);
                    } else {
                        requestInstallPermission(activity, play);
                    }
                });
            } catch (Exception unavailable) {
                activity.runOnUiThread(() -> {
                    if (!progress.isShowing() || activity.isFinishing() || activity.isDestroyed()) return;
                    progress.dismiss();
                    showFailure(activity, play);
                });
            }
        }, "Download GitHub update").start();
    }

    private static void requestInstallPermission(Activity activity, Runnable play) {
        new AlertDialog.Builder(activity)
            .setTitle("Allow installation")
            .setMessage("Android requires one-time permission for Kaldora Thor to open its installer.")
            .setPositiveButton("Open settings", (dialog, choice) -> {
                try {
                    activity.startActivityForResult(new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + activity.getPackageName())), INSTALL_PERMISSION_REQUEST);
                } catch (RuntimeException unavailable) {
                    showFailure(activity, play);
                }
            })
            .setNegativeButton("Play now", (dialog, choice) -> play.run())
            .setOnCancelListener(dialog -> play.run())
            .show();
    }

    static boolean openInstaller(Activity activity) {
        try {
            activity.startActivity(new Intent(Intent.ACTION_INSTALL_PACKAGE, UpdateFileProvider.uri(activity))
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION));
            activity.finish();
            return true;
        } catch (RuntimeException unavailable) {
            return false;
        }
    }

    private static void showFailure(Activity activity, Runnable play) {
        new AlertDialog.Builder(activity)
            .setTitle("Update unavailable")
            .setMessage("The update could not be downloaded, verified, or opened. You can keep playing.")
            .setPositiveButton("Play", (dialog, choice) -> play.run())
            .setOnCancelListener(dialog -> play.run())
            .show();
    }

    private static void downloadAndVerify(Activity activity, Offer offer) throws Exception {
        File temporary = File.createTempFile("release-", ".apk", activity.getCacheDir());
        try {
            HttpsURLConnection connection = connect(offer.url);
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            long bytes;
            try (InputStream input = connection.getInputStream();
                 FileOutputStream output = new FileOutputStream(temporary)) {
                bytes = copy(input, output, offer.size, digest);
            } finally {
                connection.disconnect();
            }
            if (bytes != offer.size || !MessageDigest.isEqual(offer.digest, digest.digest())) {
                throw new IOException("Release digest mismatch");
            }
            PackageManager packages = activity.getPackageManager();
            int flags = PackageManager.GET_SIGNING_CERTIFICATES;
            PackageInfo installed = packages.getPackageInfo(activity.getPackageName(), flags);
            PackageInfo update = packages.getPackageArchiveInfo(temporary.getPath(), flags);
            if (update == null || !installed.packageName.equals(update.packageName)
                || !offer.version.equals(update.versionName) || update.getLongVersionCode() <= installed.getLongVersionCode()
                || update.signingInfo == null || installed.signingInfo == null
                || !Arrays.equals(update.signingInfo.getApkContentsSigners(), installed.signingInfo.getApkContentsSigners())) {
                throw new IOException("APK is not a newer release signed for this app");
            }
            Files.move(temporary.toPath(), UpdateFileProvider.file(activity).toPath(),
                StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } finally {
            Files.deleteIfExists(temporary.toPath());
        }
    }

    private static HttpsURLConnection connect(String url) throws IOException {
        HttpsURLConnection connection = (HttpsURLConnection) new URL(url).openConnection();
        connection.setConnectTimeout(4500);
        connection.setReadTimeout(6000);
        connection.setRequestProperty("User-Agent", "Kaldora-Thor-Updater");
        return connection;
    }

    private static long copy(InputStream input, java.io.OutputStream output, long limit, MessageDigest digest) throws IOException {
        long end = SystemClock.elapsedRealtime() + 20_000;
        long total = 0;
        byte[] buffer = new byte[8192];
        for (int read; (read = input.read(buffer)) != -1;) {
            total += read;
            if (SystemClock.elapsedRealtime() > end || total > limit) throw new IOException("Release download limit exceeded");
            output.write(buffer, 0, read);
            if (digest != null) digest.update(buffer, 0, read);
        }
        return total;
    }

    private static boolean newer(String available, String installed) {
        if (installed == null || !installed.matches("\\d{1,6}\\.\\d{1,6}\\.\\d{1,6}")) return false;
        String[] remote = available.split("\\.");
        String[] local = installed.split("\\.");
        for (int i = 0; i < 3; i++) {
            int difference = Integer.parseInt(remote[i]) - Integer.parseInt(local[i]);
            if (difference != 0) return difference > 0;
        }
        return false;
    }

    private static final class Offer {
        final String version;
        final String url;
        final long size;
        final byte[] digest;

        private Offer(String version, String url, long size, byte[] digest) {
            this.version = version;
            this.url = url;
            this.size = size;
            this.digest = digest;
        }

        static Offer read(String response, String installed) {
            if (response.isEmpty()) return null;
            try {
                JSONObject release = new JSONObject(response);
                String tag = release.getString("tag_name");
                Matcher match = TAG.matcher(tag);
                if (release.getBoolean("draft") || release.getBoolean("prerelease")
                    || !match.matches() || !newer(match.group(1), installed)) return null;
                String url = "https://github.com/" + REPO + "/releases/download/" + tag + "/" + APK_NAME;
                JSONArray assets = release.getJSONArray("assets");
                for (int i = 0; i < assets.length(); i++) {
                    JSONObject asset = assets.getJSONObject(i);
                    if (!APK_NAME.equals(asset.optString("name"))) continue;
                    String value = asset.optString("digest");
                    long size = asset.optLong("size");
                    if (!url.equals(asset.optString("browser_download_url")) || size < 1 || size > MAX_APK_BYTES
                        || !value.matches("sha256:[0-9a-f]{64}")) return null;
                    byte[] digest = new byte[32];
                    for (int j = 0; j < digest.length; j++) {
                        int start = 7 + j * 2;
                        digest[j] = (byte) Integer.parseInt(value.substring(start, start + 2), 16);
                    }
                    return new Offer(match.group(1), url, size, digest);
                }
            } catch (org.json.JSONException invalid) {
                return null;
            }
            return null;
        }
    }
}
