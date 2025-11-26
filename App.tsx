/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { NewAppScreen } from '@react-native/new-app-screen';
import { StatusBar, StyleSheet, useColorScheme, View, PermissionsAndroid, Platform } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { useEffect, useRef } from 'react';
import { LocationService } from './LocationService';

function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();
  const locationServiceRef = useRef<LocationService | null>(null);

  useEffect(() => {
    const requestLocationPermission = async () => {
      if (Platform.OS === 'android') {
        try {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            {
              title: '位置情報の使用許可',
              message: 'このアプリは位置情報を使用してGPSドリフトを検出します。',
              buttonPositive: '許可',
              buttonNegative: '拒否',
            }
          );

          if (granted === PermissionsAndroid.RESULTS.GRANTED) {
            console.log('位置情報のパーミッションが許可されました');
            // LocationServiceのインスタンスを作成
            locationServiceRef.current = new LocationService();
            // 位置情報の監視を開始
            locationServiceRef.current.startWatching();
          } else {
            console.log('位置情報のパーミッションが拒否されました');
          }
        } catch (err) {
          console.warn('パーミッション要求エラー:', err);
        }
      } else {
        // iOSの場合は、位置情報の使用時に自動的にパーミッションダイアログが表示される
        locationServiceRef.current = new LocationService();
        locationServiceRef.current.startWatching();
      }
    };

    requestLocationPermission();

    // クリーンアップ
    return () => {
      locationServiceRef.current?.stopWatching();
    };
  }, []);

  return (
    <View style={styles.container}>
      <NewAppScreen
        templateFileName="App.tsx"
        safeAreaInsets={safeAreaInsets}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
