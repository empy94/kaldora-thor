package eu.kaldorathor;

import android.app.Activity;
import android.app.ActivityOptions;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.hardware.display.DisplayManager;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Browser;
import android.view.Display;
import android.widget.Toast;

public final class Launcher extends Activity {
    static final String GAME = "https://play.kaldora.eu/?browser=1";
    private static final String FIREFOX = "org.mozilla.firefox";

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if (!hasFirefox()) {
            showFirefoxSetup();
            return;
        }
        String token = ConnectionKey.get(this);
        new Thread(() -> {
            try { LocalBridge.start(token); }
            catch (java.io.IOException error) {
                runOnUiThread(() -> Toast.makeText(this, "Local game connection unavailable", Toast.LENGTH_LONG).show());
            }
        }, "Start local connection").start();
        DisplayManager dm = getSystemService(DisplayManager.class);
        for (Display screen : dm.getDisplays(DisplayManager.DISPLAY_CATEGORY_PRESENTATION)) {
            if (screen.getDisplayId() == Display.DEFAULT_DISPLAY || !screen.isValid()) continue;
            try {
                Intent companion = new Intent(this, Companion.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(companion, ActivityOptions.makeBasic()
                    .setLaunchDisplayId(screen.getDisplayId()).toBundle());
            } catch (RuntimeException unavailable) {
                Toast.makeText(this, "Secondary display unavailable", Toast.LENGTH_SHORT).show();
            }
            break;
        }
        try {
            Intent browser = new Intent(Intent.ACTION_VIEW, Uri.parse(GAME + "#thor=" + token)).setPackage(FIREFOX);
            browser.putExtra(Browser.EXTRA_APPLICATION_ID, getPackageName());
            startActivity(browser, ActivityOptions.makeBasic().setLaunchDisplayId(Display.DEFAULT_DISPLAY).toBundle());
        } catch (RuntimeException unavailable) {
            Toast.makeText(this, "Firefox with the Kaldora Thor extension is required", Toast.LENGTH_LONG).show();
        }
        finish();
    }

    private boolean hasFirefox() {
        try {
            return getPackageManager().getApplicationInfo(FIREFOX, 0).enabled;
        } catch (PackageManager.NameNotFoundException unavailable) {
            return false;
        }
    }

    private void showFirefoxSetup() {
        new AlertDialog.Builder(this)
            .setTitle("Set up Firefox")
            .setMessage("Install or enable Firefox, then reopen Kaldora Thor. The Kaldora Thor extension is also required.")
            .setPositiveButton("Get Firefox", (dialog, choice) -> openFirefoxListing())
            .setNegativeButton(android.R.string.cancel, (dialog, choice) -> finish())
            .setOnCancelListener(dialog -> finish())
            .show();
    }

    private void openFirefoxListing() {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + FIREFOX))
                .setPackage("com.android.vending"));
        } catch (ActivityNotFoundException noStore) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW,
                    Uri.parse("https://www.mozilla.org/firefox/browsers/mobile/android/")));
            } catch (ActivityNotFoundException noBrowser) {
                Toast.makeText(this, "Open the Play Store and search for Firefox", Toast.LENGTH_LONG).show();
            }
        }
        finish();
    }
}
