import { Redirect } from 'expo-router';

// Sign up is now handled by the combined auth screen (signin.tsx)
// This redirect ensures any deep links or existing navigation still work
export default function SignUp() {
  return <Redirect href="/(auth)/signin" />;
}
