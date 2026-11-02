import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GameProvider } from './src/app/state';
import type { RootStackParamList } from './src/app/types';
import MenuScreen from './src/app/screens/MenuScreen';
import CreateScreen from './src/app/screens/CreateScreen';
import GameScreen from './src/app/screens/GameScreen';
import CrisisModal from './src/app/components/CrisisModal';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <GameProvider>
        <NavigationContainer>
          <StatusBar style="auto" />
          <Stack.Navigator initialRouteName="Menu" screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Menu" component={MenuScreen} />
            <Stack.Screen name="Create" component={CreateScreen} />
            <Stack.Screen name="Game" component={GameScreen} />
          </Stack.Navigator>
        </NavigationContainer>
        {/* Global overlay: renders above the navigator whenever a Black Swan or
            confidence alert is live. Must sit inside GameProvider for useGame(). */}
        <CrisisModal />
      </GameProvider>
    </SafeAreaProvider>
  );
}
