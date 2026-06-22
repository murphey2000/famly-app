import { Alert } from 'react-native';
import { polyfillGlobal as untypedPolyfillGlobal } from 'react-native/Libraries/Utilities/PolyfillFunctions';

// react-native/Libraries/Utilities/PolyfillFunctions has no type declarations,
// so we type the import directly instead of augmenting the untyped module.
const polyfillGlobal = untypedPolyfillGlobal as (name: string, getValue: () => unknown) => void;

// Add global alert() on iOS/Android — it doesn't exist by default in React Native.
// On web, alert.web.ts is used instead (Metro picks .web.ts automatically).
polyfillGlobal('alert', () => (message?: string) => {
  Alert.alert('', String(message ?? ''));
});
