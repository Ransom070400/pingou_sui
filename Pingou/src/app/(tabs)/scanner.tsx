import { View, Text, Button, Alert } from 'react-native';
import React, { useState } from 'react';
import { CameraView, CameraType, useCameraPermissions, BarcodeScanningResult } from 'expo-camera';
import { QrCode } from 'lucide-react-native';
import { Feedback } from '~/src/utils/Feedback';
import { supabase } from '~/src/lib/supabase';
import { useAuth } from '~/src/context/AuthProvider';
import { useSuiAuth } from '~/src/context/SuiAuthProvider';
import { SUI_ENABLED } from '~/src/lib/sui/config';
import { exchange } from '~/src/lib/sui/profileService';
import { parseConnectQR } from '~/src/lib/sui/share';
import { markAnnounced } from '~/src/lib/sui/announced';
import { notifyConnection } from '~/src/lib/sui/realtime';
import { ProfileType } from '~/src/types/ProfileTypes';
import { router } from 'expo-router';
import { parseEventCodeFromScan, joinEventByCode } from '~/src/utils/events';
import ConnectionToast, { ConnectionToastData } from '~/src/components/ConnectionToast';
import ConnectionSuccess, { ConnectionSuccessData } from '~/src/components/ConnectionSuccess';

const Scanner = () => {
  const [facing] = useState<CameraType>('back');
  const [permission, requestPermission] = useCameraPermissions();
  const [scannedData, setScannedData] = useState<BarcodeScanningResult | null>(null);
  const [toast, setToast] = useState<ConnectionToastData | null>(null);
  const [success, setSuccess] = useState<ConnectionSuccessData | null>(null);
  const { session } = useAuth();
  const sui = useSuiAuth();

  if (!permission) {
    return <View />;
  }

  // Sui exchange: the QR carries the peer's address + profile id + share-code. One
  // sponsored tx grants BOTH directions (I can read them; they can read me), then we
  // read their card immediately. No share-back needed.
  const handleSuiScan = async (rawData: string) => {
    const { address, signer, profileRef } = sui;
    if (!address || !signer) {
      Alert.alert('Error', 'You must be signed in to connect');
      return;
    }
    if (!profileRef) {
      Alert.alert('Set up your profile', 'Create your profile first so you have a card to share.');
      return;
    }
    const peer = parseConnectQR(rawData);
    if (!peer) {
      Alert.alert('Invalid code', 'That QR is not a Pingou code');
      return;
    }
    if (peer.address === address) {
      Alert.alert('Oops', "You can't connect with yourself!");
      return;
    }

    // Pop the overlay immediately with a spinner; resolve it when the exchange lands.
    Feedback.medium();
    setSuccess({ loading: true });
    try {
      const data = await exchange(address, signer, profileRef, peer);
      Feedback.ping(); // signature chime + haptic on a successful connection
      markAnnounced(peer.address); // so my own home poll doesn't re-pop this
      // Instantly notify the scanned device so it pops the checkmark too.
      notifyConnection(peer.address, {
        from: address,
        name: sui.profile?.fullname,
        avatar: sui.profile?.avatar ?? undefined,
        profileId: profileRef.profileObjectId,
      });
      setSuccess({
        loading: false,
        name: data.fullname,
        avatarUrl: data.avatar ?? null,
        address: peer.address,
        onViewProfile: () =>
          router.push({
            pathname: '/connectionDetail',
            params: { profileId: peer.profileId, address: peer.address },
          }),
      });
    } catch (e: any) {
      setSuccess(null);
      Alert.alert('Connection failed', e?.message ?? 'Something went wrong');
    }
  };

  const handleBarCodeScanned = async (result: BarcodeScanningResult) => {
    if (scannedData) return;
    setScannedData(result);
    Feedback.success();

    if (SUI_ENABLED) {
      await handleSuiScan(result.data.trim());
      setScannedData(null);
      return;
    }

    const scannedUserId = result.data;

    if (!session?.user?.id) {
      Alert.alert('Error', 'You must be logged in to connect');
      setScannedData(null);
      return;
    }

    // Event QR: deep link of the form pingou://event/<CODE>
    const eventCode = parseEventCodeFromScan(scannedUserId);
    if (eventCode) {
      try {
        const folderId = await joinEventByCode(eventCode);
        Feedback.success();
        Alert.alert('Joined!', 'You are now part of this event', [
          {
            text: 'View',
            onPress: () =>
              router.push(`/eventFolder?folderId=${folderId}` as any),
          },
          { text: 'OK' },
        ]);
      } catch (err: any) {
        Alert.alert('Could not join', err.message ?? 'Invalid event code');
      }
      setScannedData(null);
      return;
    }

    if (scannedUserId === session.user.id) {
      Alert.alert('Oops', "You can't connect with yourself!");
      setScannedData(null);
      return;
    }

    // Look up the scanned user's profile
    const { data: scannedProfile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', scannedUserId)
      .single();

    if (profileError || !scannedProfile) {
      Alert.alert('Not Found', 'Could not find that user');
      setScannedData(null);
      return;
    }

    const profile = scannedProfile as ProfileType;

    // Create connection (your side)
    const { error: connError } = await supabase.from('connections').upsert(
      { owner_id: session.user.id, connected_to: scannedUserId },
      { onConflict: 'owner_id,connected_to', ignoreDuplicates: true }
    );

    if (connError) {
      Alert.alert('Error', connError.message);
    } else {
      // The signature "ping": chime + success haptic, then a non-blocking banner.
      Feedback.ping();
      setToast({
        name: profile.fullname,
        avatarUrl: profile.profile_url ?? null,
        onPress: () =>
          router.push({ pathname: '/connectionDetail', params: { userId: scannedUserId } }),
      });
    }

    setScannedData(null);
  };

  if (!permission.granted) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <Text className="text-black">We need your permission to show the camera</Text>
        <Button onPress={requestPermission} title="Grant permission" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <CameraView
        style={{ flex: 1, width: '100%' }}
        facing={facing}
        onBarcodeScanned={handleBarCodeScanned}>
        {/* Header overlay */}
        <View className="absolute left-0 right-0 top-16 z-10 mt-[60px] items-center">
          <Text className="mb-2 text-2xl font-bold text-white">Scan QR code to connect</Text>
          <Text className="text-base text-white/80">Position QR code within frame</Text>
        </View>

        {/* Centered QR frame */}
        <View className="absolute inset-0 items-center justify-center">
          <QrCode size={200} color="rgba(255,255,255,0.6)" />
        </View>
      </CameraView>

      {/* Connection success banner (Supabase mode) + checkmark popup (Sui mode) */}
      <ConnectionToast data={toast} onHide={() => setToast(null)} />
      <ConnectionSuccess data={success} onClose={() => setSuccess(null)} />
    </View>
  );
};

export default Scanner;
