import React, { useState, useEffect, useRef } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { MaterialIcons } from '@expo/vector-icons';

// Update these URLs with your computer's IP address
const SERVER_URL = 'http://192.168.1.108:8000';
const WS_URL = 'ws://192.168.1.108:8000/ws/mobile_app';

export default function App() {
  const [messages, setMessages] = useState([]);
  const [carNumber, setCarNumber] = useState('');
  const [image, setImage] = useState(null);
  const scrollViewRef = useRef(null);
  const ws = useRef(null);

  useEffect(() => {
    // Request camera and media library permissions
    (async () => {
      try {
        const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
        const { status: mediaStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        
        if (cameraStatus !== 'granted' || mediaStatus !== 'granted') {
          Alert.alert('Permission Required', 'Camera and media library permissions are required to use this app.');
          return;
        }
      } catch (error) {
        console.error('Error requesting permissions:', error);
        Alert.alert('Error', 'Failed to request permissions');
      }
    })();

    // Connect to WebSocket
    ws.current = new WebSocket(WS_URL);

    ws.current.onopen = () => {
      console.log('WebSocket Connected');
    };

    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setMessages(prev => [...prev, data]);
    };

    ws.current.onerror = (error) => {
      console.error('WebSocket Error:', error);
      Alert.alert('Connection Error', 'Failed to connect to server');
    };

    ws.current.onclose = () => {
      console.log('WebSocket Disconnected');
    };

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  const pickImage = async () => {
    try {
      // First check if we have permission
      const { status } = await ImagePicker.getMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant media library permission to pick images');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 1,
        base64: false,
      });

      if (!result.canceled) {
        console.log('Image picked successfully:', result.assets[0].uri);
        setImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image. Please try again.');
    }
  };

  const takePhoto = async () => {
    try {
      // First check if we have permission
      const { status } = await ImagePicker.getCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Please grant camera permission to take photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 1,
        base64: false,
      });

      if (!result.canceled) {
        console.log('Photo taken successfully:', result.assets[0].uri);
        setImage(result.assets[0].uri);
      }
    } catch (error) {
      console.error('Error taking photo:', error);
      Alert.alert('Error', 'Failed to take photo. Please try again.');
    }
  };

  const uploadImage = async () => {
    if (!image) {
      Alert.alert('Error', 'Please select an image first');
      return;
    }

    try {
      const formData = new FormData();
      formData.append('file', {
        uri: image,
        type: 'image/jpeg',
        name: 'photo.jpg',
      });
      
      // Only append car number if it exists
      if (carNumber) {
        formData.append('car_number', carNumber);
      }

      console.log('Uploading image:', image);
      const response = await fetch(`${SERVER_URL}/upload-image/`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to upload image');
      }

      const data = await response.json();
      console.log('Upload successful:', data);
      setImage(null);
      Alert.alert('Success', 'Image uploaded successfully');
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to upload image. Please try again.');
    }
  };

  const sendCarNumber = async () => {
    if (!carNumber) {
      Alert.alert('Error', 'Please enter a car number');
      return;
    }

    try {
      const response = await fetch(`${SERVER_URL}/messages/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: `Car number submitted: ${carNumber}`,
          timestamp: new Date().toISOString(),
          car_number: carNumber,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send car number');
      }

      setCarNumber('');
      Alert.alert('Success', 'Car number sent successfully');
    } catch (error) {
      console.error('Error sending car number:', error);
      Alert.alert('Error', 'Failed to send car number. Please try again.');
    }
  };

  const renderMessage = (msg, index) => {
    const isServer = msg.client_id === 'server';
    const hasImage = msg.image_path;

    return (
      <View key={index} style={[styles.messageContainer, isServer ? styles.serverMessage : styles.clientMessage]}>
        {hasImage && (
          <Image
            source={{ uri: `${SERVER_URL}/images/${msg.image_path}` }}
            style={styles.messageImage}
            resizeMode="cover"
          />
        )}
        {msg.message && (
          <View style={styles.messageContent}>
            <Text style={styles.messageText}>{msg.message}</Text>
            {msg.car_number && (
              <Text style={styles.carNumber}>Car: {msg.car_number}</Text>
            )}
            <Text style={styles.timestamp}>
              {new Date(msg.timestamp).toLocaleTimeString()}
            </Text>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Car Image Upload</Text>
        <Text style={styles.serverUrl}>{SERVER_URL}</Text>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidingView}
      >
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((msg, index) => renderMessage(msg, index))}
        </ScrollView>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.carNumberInput}
            placeholder="Enter Car Number (8 chars)"
            value={carNumber}
            onChangeText={(text) => setCarNumber(text.slice(0, 8))}
            maxLength={8}
          />
          <View style={styles.buttonContainer}>
            <TouchableOpacity style={styles.imageButton} onPress={takePhoto}>
              <MaterialIcons name="camera-alt" size={24} color="#007AFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
              <MaterialIcons name="photo-library" size={24} color="#007AFF" />
            </TouchableOpacity>
            {image && (
              <TouchableOpacity style={styles.uploadButton} onPress={uploadImage}>
                <MaterialIcons name="cloud-upload" size={24} color="#007AFF" />
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.sendButton} onPress={sendCarNumber}>
              <MaterialIcons name="send" size={24} color="#007AFF" />
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    padding: 16,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  serverUrl: {
    fontSize: 12,
    color: '#FFFFFF',
    marginTop: 4,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
    padding: 16,
  },
  messageContainer: {
    marginBottom: 16,
    maxWidth: '80%',
    borderRadius: 12,
    padding: 12,
  },
  clientMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
  },
  serverMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#E5E5EA',
  },
  messageContent: {
    marginTop: 4,
  },
  messageText: {
    fontSize: 16,
    color: '#000000',
  },
  carNumber: {
    fontSize: 14,
    color: '#666666',
    marginTop: 4,
  },
  timestamp: {
    fontSize: 12,
    color: '#666666',
    marginTop: 4,
  },
  messageImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginBottom: 8,
  },
  inputContainer: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
  },
  carNumberInput: {
    borderWidth: 1,
    borderColor: '#E5E5EA',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    fontSize: 16,
    backgroundColor: '#F8F8F8',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: 8,
  },
  imageButton: {
    padding: 12,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
  },
  uploadButton: {
    padding: 12,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
  },
  sendButton: {
    padding: 12,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
  },
});
