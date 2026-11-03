import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

// Release signing key lives OUTSIDE the repo (never committed):
//   %USERPROFILE%\.cybershield360elease.properties  -> storeFile, storePassword, keyAlias, keyPassword
// Override the location with CS360_SIGNING=/path/to/release.properties.
val signingFile = file(System.getenv("CS360_SIGNING")
    ?: "${System.getProperty("user.home")}/.cybershield360/release.properties")
val signingProps = Properties().apply { if (signingFile.exists()) signingFile.inputStream().use { load(it) } }

android {
    namespace = "com.cybershield360.protect"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.cybershield360.protect"
        // 27+: NotificationManager.isNotificationListenerAccessGranted.
        minSdk = 27
        targetSdk = 35
        versionCode = 2
        versionName = "0.2.0"
    }

    signingConfigs {
        if (signingProps.isNotEmpty()) {
            create("release") {
                storeFile = file(signingProps.getProperty("storeFile"))
                storePassword = signingProps.getProperty("storePassword")
                keyAlias = signingProps.getProperty("keyAlias")
                keyPassword = signingProps.getProperty("keyPassword")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.findByName("release")
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_11
        targetCompatibility = JavaVersion.VERSION_11
    }
    kotlinOptions {
        jvmTarget = "11"
    }
    testOptions {
        // Unit tests cover the pure-Kotlin logic; android.* calls return defaults.
        unitTests.isReturnDefaultValues = true
    }
}

dependencies {
    // Platform APIs only (no AndroidX): nothing beyond the Kotlin standard library ships in the APK.
    testImplementation("junit:junit:4.13.2")
}
