/**
 * Main App Component
 */

import React, { useEffect, useState } from 'react';
import { StyleSheet, View, Text, SafeAreaView, StatusBar } from 'react-native';
import { NativeWebView } from '@/components/NativeWebView';
import { getCartridgeController } from '@/cartridge/CartridgeController';

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    initializeApp();
  }, []);

  const initializeApp = async () => {
    try {
      // Initialize Cartridge Controller
      const controller = getCartridgeController();
      await controller.initialize();
      
      setIsInitialized(true);
    } catch (err: any) {
      console.error('Failed to initialize app:', err);
      setError(err.message || 'Failed to initialize app');
    }
  };

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Initialization Error</Text>
          <Text style={styles.errorMessage}>{error}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isInitialized) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor="#000000" />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading Loot Survivor...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <NativeWebView />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  loadingText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    padding: 20,
  },
  errorTitle: {
    color: '#ff4444',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  errorMessage: {
    color: '#ffffff',
    fontSize: 14,
    textAlign: 'center',
  },
});
