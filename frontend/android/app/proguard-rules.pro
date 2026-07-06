# Keep Capacitor classes
-keep class com.getcapacitor.** { *; }
-keep class * extends com.getcapacitor.Plugin { *; }
-keep class * extends com.getcapacitor.Bridge { *; }

# Keep Google LiteRT / TensorFlow Lite classes
-keep class com.google.ai.edge.litertlm.** { *; }
-keep class com.google.tensorflow.** { *; }
-keep class org.tensorflow.** { *; }
