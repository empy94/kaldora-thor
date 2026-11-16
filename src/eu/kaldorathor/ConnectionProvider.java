package eu.kaldorathor;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.os.Binder;
import android.os.Bundle;
import android.os.Process;

public final class ConnectionProvider extends ContentProvider {
    @Override public boolean onCreate() { return true; }
    @Override public Bundle call(String method, String arg, Bundle extras) {
        int uid = Binder.getCallingUid();
        if (uid != Process.SHELL_UID && uid != Process.myUid()) throw new SecurityException("ADB access only");
        if (!"key".equals(method)) return null;
        Bundle result = new Bundle();
        result.putString("key", ConnectionKey.get(getContext()));
        return result;
    }
    @Override public String getType(Uri uri) { return null; }
    @Override public Cursor query(Uri uri, String[] projection, String selection, String[] args, String sort) { throw new SecurityException(); }
    @Override public Uri insert(Uri uri, ContentValues values) { throw new SecurityException(); }
    @Override public int delete(Uri uri, String selection, String[] args) { throw new SecurityException(); }
    @Override public int update(Uri uri, ContentValues values, String selection, String[] args) { throw new SecurityException(); }
}
