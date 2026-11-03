plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

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

    buildTypes {
        release {
            isMinifyEnabled = false
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
