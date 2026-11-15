package eu.kaldorathor;

import android.app.Activity;
import android.app.ActivityOptions;
import android.content.Intent;
import android.hardware.display.DisplayManager;
import android.net.Uri;
import android.os.Bundle;
import android.view.Display;
import android.widget.Toast;

public final class Launcher extends Activity {
    static final String GAME = "https://play.kaldora.eu/";

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if (state != null) { finish(); return; }
        DisplayManager dm = getSystemService(DisplayManager.class);
        for (Display screen : dm.getDisplays(DisplayManager.DISPLAY_CATEGORY_PRESENTATION)) {
            if (screen.getDisplayId() == Display.DEFAULT_DISPLAY || !screen.isValid()) continue;
            try {
                Intent companion = new Intent(this, Companion.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(companion, ActivityOptions.makeBasic()
                    .setLaunchDisplayId(screen.getDisplayId()).toBundle());
            } catch (RuntimeException unavailable) {
                Toast.makeText(this, "Écran secondaire indisponible", Toast.LENGTH_SHORT).show();
            }
            break;
        }
        try {
            Intent browser = new Intent(Intent.ACTION_VIEW, Uri.parse(GAME)).setPackage("com.android.chrome");
            startActivity(browser, ActivityOptions.makeBasic().setLaunchDisplayId(Display.DEFAULT_DISPLAY).toBundle());
        } catch (RuntimeException unavailable) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(GAME)));
            } catch (RuntimeException noBrowser) {
                Toast.makeText(this, "Aucun navigateur disponible", Toast.LENGTH_LONG).show();
            }
        }
        finish();
    }
}
