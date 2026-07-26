import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useAuth } from '@/src/context/AuthContext';
import { colors } from '@/src/theme';

export default function Index() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.container} testID="splash-loading">
        <ActivityIndicator size="large" color={colors.white} />
      </View>
    );
  }

  if (!user) return <Redirect href="/auth/login" />;
  if (user.role === 'admin') return <Redirect href="/(admin)/dashboard" />;
  if (user.role === 'inventory_manager') return <Redirect href="/(inventory)/stock" />;
  return <Redirect href="/(customer)/home" />;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
});
