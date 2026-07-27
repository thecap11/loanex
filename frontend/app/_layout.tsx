import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { LogBox, StatusBar } from "react-native";
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { AuthProvider } from "@/src/context/AuthContext";
import { CartProvider } from "@/src/context/CartContext";
import { AlertProvider } from "@/src/context/AlertContext";

LogBox.ignoreAllLogs(true)

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) {
      SplashScreen.hideAsync();
    }
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#0A0A1A' }}>
      <SafeAreaProvider>
        <AuthProvider>
          <CartProvider>
            <AlertProvider>
              <StatusBar barStyle="light-content" backgroundColor="#0A0A1A" />
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0A0A1A' } }} />
            </AlertProvider>
          </CartProvider>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
