/**
 * Native WebView Component
 * 
 * Renders the web app in a WebView with bridge communication support.
 */

import React, { useRef, useCallback, useEffect } from 'react';
import { StyleSheet, View, ActivityIndicator, Platform } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import Constants from 'expo-constants';
import { getBridgeHandler } from '@/bridge/BridgeHandler';
import { isOriginAllowed } from '@/utils/security';
import { BridgeRequest } from '@/types/bridge';

const WEB_URL = Constants.expoConfig?.extra?.webUrl || 
                process.env.EXPO_PUBLIC_NATIVE_WEB_URL || 
                'https://lootsurvivor.io';

export const NativeWebView: React.FC = () => {
  const webViewRef = useRef<WebView>(null);
  const bridgeHandler = getBridgeHandler();

  /**
   * Handle messages from the WebView
   */
  const handleMessage = useCallback(async (event: WebViewMessageEvent) => {
    const { data, url } = event.nativeEvent;
    const origin =
      typeof url === "string" ? url.split("/").slice(0, 3).join("/") : "";

    // Validate origin
    if (!isOriginAllowed(origin)) {
      console.warn(`Blocked message from unauthorized origin: ${origin}`);
      return;
    }

    try {
      const request: BridgeRequest = JSON.parse(data);
      console.log(`Bridge request: ${request.method}`, request.id);

      // Handle the request
      const response = await bridgeHandler.handleRequest(request);

      // Send response back to WebView
      webViewRef.current?.postMessage(JSON.stringify(response));
    } catch (error) {
      console.error('Failed to handle bridge message:', error);
    }
  }, [bridgeHandler]);

  /**
   * Inject JavaScript to set up the bridge on the web side
   */
  const injectedJavaScript = `
    (function() {
      // Flag to indicate we're running in native shell
      window.__NATIVE_SHELL__ = true;
      
      // Create the bridge interface
      window.NativeBridge = {
        pendingRequests: new Map(),
        requestId: 0,
        
        // Send a request to native
        request: function(method, params) {
          return new Promise((resolve, reject) => {
            const id = String(++this.requestId);
            const timestamp = Date.now();
            
            // Store the promise handlers
            this.pendingRequests.set(id, { resolve, reject });
            
            // Send the request
            const request = {
              id,
              method,
              params,
              timestamp
            };
            
            window.ReactNativeWebView.postMessage(JSON.stringify(request));
            
            // Timeout after 30 seconds
            setTimeout(() => {
              if (this.pendingRequests.has(id)) {
                this.pendingRequests.delete(id);
                reject(new Error('Request timeout'));
              }
            }, 30000);
          });
        },
        
        // Handle response from native
        handleResponse: function(response) {
          const pending = this.pendingRequests.get(response.id);
          if (!pending) {
            console.warn('Received response for unknown request:', response.id);
            return;
          }
          
          this.pendingRequests.delete(response.id);
          
          if (response.error) {
            pending.reject(response.error);
          } else {
            pending.resolve(response.result);
          }
        }
      };
      
      // Listen for messages from native
      document.addEventListener('message', function(event) {
        try {
          const response = JSON.parse(event.data);
          window.NativeBridge.handleResponse(response);
        } catch (error) {
          console.error('Failed to parse bridge response:', error);
        }
      });
      
      // For iOS
      window.addEventListener('message', function(event) {
        try {
          const response = JSON.parse(event.data);
          window.NativeBridge.handleResponse(response);
        } catch (error) {
          console.error('Failed to parse bridge response:', error);
        }
      });
      
      console.log('Native bridge initialized');
    })();
    true; // Required for iOS
  `;

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: WEB_URL }}
        style={styles.webview}
        onMessage={handleMessage}
        injectedJavaScript={injectedJavaScript}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        startInLoadingState={true}
        renderLoading={() => (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#ffffff" />
          </View>
        )}
        // Allow web workers
        allowFileAccess={true}
        allowFileAccessFromFileURLs={true}
        allowUniversalAccessFromFileURLs={true}
        // Security
        originWhitelist={['https://*', 'http://localhost:*', 'http://127.0.0.1:*']}
        // Performance
        cacheEnabled={true}
        cacheMode="LOAD_DEFAULT"
        // iOS specific
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        // Android specific
        mixedContentMode="always"
        thirdPartyCookiesEnabled={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
});
