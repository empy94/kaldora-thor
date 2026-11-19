package eu.kaldorathor;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;

public final class UpdateFileProvider extends ContentProvider {
    private static final String MIME = "application/vnd.android.package-archive";

    static File file(Context context) {
        return new File(context.getCacheDir(), ReleaseUpdater.APK_NAME);
    }

    static Uri uri(Context context) {
        return new Uri.Builder().scheme("content").authority(context.getPackageName() + ".update")
            .appendPath(ReleaseUpdater.APK_NAME).build();
    }

    @Override public boolean onCreate() { return true; }

    @Override public String getType(Uri uri) {
        return uri(getContext()).equals(uri) ? MIME : null;
    }

    @Override public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        if (!uri(getContext()).equals(uri) || !"r".equals(mode)) throw new FileNotFoundException();
        return ParcelFileDescriptor.open(file(getContext()), ParcelFileDescriptor.MODE_READ_ONLY);
    }

    @Override public Cursor query(Uri uri, String[] projection, String selection, String[] args, String sort) {
        if (!uri(getContext()).equals(uri)) return null;
        String[] columns = projection == null
            ? new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE} : projection;
        MatrixCursor cursor = new MatrixCursor(columns, 1);
        MatrixCursor.RowBuilder row = cursor.newRow();
        for (String column : columns) {
            if (OpenableColumns.DISPLAY_NAME.equals(column)) row.add(ReleaseUpdater.APK_NAME);
            else if (OpenableColumns.SIZE.equals(column)) row.add(file(getContext()).length());
            else row.add(null);
        }
        return cursor;
    }

    @Override public Uri insert(Uri uri, ContentValues values) { throw new UnsupportedOperationException(); }
    @Override public int update(Uri uri, ContentValues values, String selection, String[] args) { throw new UnsupportedOperationException(); }
    @Override public int delete(Uri uri, String selection, String[] args) { throw new UnsupportedOperationException(); }
}
