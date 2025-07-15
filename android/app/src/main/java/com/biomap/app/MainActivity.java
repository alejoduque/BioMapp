package com.biomap.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

public class MainActivity extends BridgeActivity {
    private static final int AUDIO_PERMISSION_REQUEST_CODE = 1;
    private static final int LOCATION_PERMISSION_REQUEST_CODE = 2;
    private static final String TAG = "MainActivity";
    private PermissionRequest pendingPermissionRequest;
    private String[] pendingResources;

    @Override
    public void onStart() {
        super.onStart();

        bridge.getWebView().setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                // Handle permission requests from JavaScript
                String[] resources = request.getResources();
                boolean needsAudio = false;
                for (String resource : resources) {
                    if (resource.equals(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) {
                        needsAudio = true;
                    }
                }
                if (needsAudio) {
                    if (ContextCompat.checkSelfPermission(MainActivity.this,
                            Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                        request.grant(resources);
                    } else {
                        // Store the request and ask for permission
                        pendingPermissionRequest = request;
                        pendingResources = resources;
                        ActivityCompat.requestPermissions(MainActivity.this,
                                new String[]{Manifest.permission.RECORD_AUDIO}, AUDIO_PERMISSION_REQUEST_CODE);
                    }
                } else {
                    // Grant other resources (e.g., video) immediately
                    request.grant(resources);
                }
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin,
                                                          GeolocationPermissions.Callback callback) {
                if (ContextCompat.checkSelfPermission(MainActivity.this,
                        Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                    callback.invoke(origin, true, false);
                } else {
                    ActivityCompat.requestPermissions(MainActivity.this,
                            new String[]{Manifest.permission.ACCESS_FINE_LOCATION}, LOCATION_PERMISSION_REQUEST_CODE);
                    callback.invoke(origin, true, false);
                }
            }
        });
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == AUDIO_PERMISSION_REQUEST_CODE && pendingPermissionRequest != null) {
            boolean granted = grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED;
            if (granted) {
                // Grant the WebView permission
                pendingPermissionRequest.grant(pendingResources);
            } else {
                pendingPermissionRequest.deny();
            }
            pendingPermissionRequest = null;
            pendingResources = null;
        }
    }
}
