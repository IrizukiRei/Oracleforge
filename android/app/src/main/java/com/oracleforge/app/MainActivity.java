package com.oracleforge.app;

import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;

import androidx.core.content.FileProvider;

import com.getcapacitor.BridgeActivity;

import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().addJavascriptInterface(new NativeExportBridge(), "NativeExport");
        }
    }

    private void notifyJsExportResult(boolean success, String message) {
        if (bridge == null || bridge.getWebView() == null) return;
        final String safeMessage = message == null ? "" : message;
        final String js = "window.onNativeExportResult && window.onNativeExportResult("
                + success + ", " + JSONObject.quote(safeMessage) + ");";
        bridge.getWebView().post(() -> bridge.getWebView().evaluateJavascript(js, null));
    }

    private class NativeExportBridge {
        @JavascriptInterface
        public void shareJson(String fileName, String jsonContent) {
            runOnUiThread(() -> {
                try {
                    String safeFileName = (fileName == null || fileName.trim().isEmpty())
                            ? "oracleforge-backup.json"
                            : fileName.trim();
                    if (!safeFileName.endsWith(".json")) {
                        safeFileName = safeFileName + ".json";
                    }

                    File outFile = new File(getCacheDir(), safeFileName);
                    try (FileOutputStream fos = new FileOutputStream(outFile, false)) {
                        fos.write((jsonContent == null ? "" : jsonContent).getBytes(StandardCharsets.UTF_8));
                    }

                    Uri uri = FileProvider.getUriForFile(
                            MainActivity.this,
                            getPackageName() + ".fileprovider",
                            outFile
                    );

                    Intent shareIntent = new Intent(Intent.ACTION_SEND);
                    shareIntent.setType("application/json");
                    shareIntent.putExtra(Intent.EXTRA_STREAM, uri);
                    shareIntent.putExtra(Intent.EXTRA_SUBJECT, "OracleForge Backup");
                    shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

                    Intent chooser = Intent.createChooser(shareIntent, "Share backup file");
                    startActivity(chooser);
                    notifyJsExportResult(true, "");
                } catch (Exception e) {
                    notifyJsExportResult(false, e.getMessage());
                }
            });
        }
    }
}
