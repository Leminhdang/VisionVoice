import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';

export default function App() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.title}>VisionVoice</Text>
      <Text style={styles.subtitle}>Đang được xây dựng lại</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#07070E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '800',
  },
  subtitle: {
    color: '#94A3B8',
    fontSize: 18,
    marginTop: 8,
  },
});
