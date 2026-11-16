package eu.kaldorathor;

import android.app.Activity;
import android.app.ActivityOptions;
import android.content.Intent;
import android.hardware.display.DisplayManager;
import android.net.Uri;
import android.os.Bundle;
import android.provider.Browser;
import android.view.Display;
import android.widget.Toast;

public final class Launcher extends Activity {
    static final String GAME = "https://play.kaldora.eu/?browser=1";

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if (state != null) { finish(); return; }
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
            Intent browser = new Intent(Intent.ACTION_VIEW, Uri.parse(GAME + "#thor=" + token)).setPackage("org.mozilla.firefox");
            browser.putExtra(Browser.EXTRA_APPLICATION_ID, getPackageName());
            startActivity(browser, ActivityOptions.makeBasic().setLaunchDisplayId(Display.DEFAULT_DISPLAY).toBundle());
        } catch (RuntimeException unavailable) {
            Toast.makeText(this, "Firefox with the Kaldora Thor extension is required", Toast.LENGTH_LONG).show();
        }
        finish();
    }
}
