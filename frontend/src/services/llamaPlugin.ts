import { registerPlugin, Capacitor } from '@capacitor/core';
import { Toast } from '@capacitor/toast';

export interface LlamaPluginInterface {
  loadModel(options: { modelPath: string }): Promise<{ success: boolean; message?: string }>;
  generateCompletion(options: { prompt: string; systemInstruction?: string }): Promise<{ text: string }>;
  checkModelExists(options: { modelPath: string }): Promise<{ exists: boolean }>;
}

const LlamaPluginNative = registerPlugin<LlamaPluginInterface>('LlamaPlugin');

let isModelLoaded = false;
let isLoadingModel = false;

// Model filename
const MODEL_FILENAME = 'google_gemma-4-E2B-it-Q2_K.gguf';

// Get the default model path for the current platform
const getModelDefaultPath = (): string => {
  if (Capacitor.getPlatform() === 'android') {
    // Android public Downloads directory — accessible via java.io.File in the native plugin
    // Capacitor's sandboxed Filesystem API cannot reach this path, so we delegate to Java
    return `/storage/emulated/0/Download/${MODEL_FILENAME}`;
  } else if (Capacitor.getPlatform() === 'ios') {
    // iOS: user places file via Files app. Native plugin reads from Documents dir.
    return `Documents/${MODEL_FILENAME}`;
  }
  return '';
};

export const llamaPlugin = {
  isSupported(): boolean {
    return Capacitor.isNativePlatform();
  },

  async checkModelExists(): Promise<boolean> {
    if (!this.isSupported()) return false;
    const path = getModelDefaultPath();
    try {
      // Delegate to native Java/Swift plugin — it uses java.io.File which can access external storage
      const result = await LlamaPluginNative.checkModelExists({ modelPath: path });
      console.log('[LlamaPlugin] checkModelExists:', result.exists, 'path:', path);
      return result.exists;
    } catch (e) {
      console.warn('[LlamaPlugin] checkModelExists not supported by native plugin, proceeding to load:', e);
      // Graceful fallback: attempt loading and let loadModel() report "not found"
      return true;
    }
  },

  async ensureModelLoaded(): Promise<boolean> {
    if (!this.isSupported()) return false;
    if (isModelLoaded) return true;
    if (isLoadingModel) {
      // Wait for concurrent load to finish
      while (isLoadingModel) {
        await new Promise(r => setTimeout(r, 500));
      }
      return isModelLoaded;
    }

    isLoadingModel = true;
    const path = getModelDefaultPath();
    console.log('[LlamaPlugin] Loading model from:', path);

    try {
      await Toast.show({
        text: `Loading Gemma 4 from Downloads... (10-30 seconds)`,
        duration: 'long'
      });

      const res = await LlamaPluginNative.loadModel({ modelPath: path });

      if (res.success) {
        isModelLoaded = true;
        console.log('[LlamaPlugin] Model loaded successfully!');
        await Toast.show({
          text: '✅ Local Gemma 4 ready! Running offline AI.',
          duration: 'short'
        });
        return true;
      } else {
        const msg = res.message || 'Model file not found';
        console.error('[LlamaPlugin] Load failed:', msg);
        await Toast.show({
          text: `⚠️ Place "${MODEL_FILENAME}" in your Phone's Downloads folder.`,
          duration: 'long'
        });
        return false;
      }
    } catch (err: any) {
      console.error('[LlamaPlugin] Failed to load model:', err);
      await Toast.show({
        text: `❌ Model error. Check "${MODEL_FILENAME}" is in Downloads.`,
        duration: 'long'
      });
      return false;
    } finally {
      isLoadingModel = false;
    }
  },

  async getCompletion(prompt: string, systemInstruction?: string): Promise<string> {
    if (!this.isSupported()) {
      throw new Error('Local inference is only supported on mobile devices.');
    }

    const loaded = await this.ensureModelLoaded();
    if (!loaded) {
      throw new Error(`Could not load local model. Place "${MODEL_FILENAME}" in Downloads.`);
    }

    try {
      const res = await LlamaPluginNative.generateCompletion({ prompt, systemInstruction });
      return res.text;
    } catch (err: any) {
      console.error('[LlamaPlugin] Inference error:', err);
      throw err;
    }
  }
};
