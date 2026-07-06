#import <Capacitor/Capacitor.h>

CAP_PLUGIN(LlamaPlugin, "LlamaPlugin",
           CAP_PLUGIN_METHOD(loadModel, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(generateCompletion, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(speak, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(stopSpeak, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(checkModelExists, CAPPluginReturnPromise);
           CAP_PLUGIN_METHOD(selectModelFile, CAPPluginReturnPromise);
)
