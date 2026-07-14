package com.ing.datalib.util;

import java.io.File;
import java.io.IOException;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Resolves application-owned Runtime paths without depending on Engine.
 */
public final class RuntimePath {
    public static final String APP_HOME_PROPERTY = "ingenious.app.home";

    private RuntimePath() {}

    public static String getAppRoot() {
        String configuredPath = System.getProperty(APP_HOME_PROPERTY);

        if (configuredPath != null && !configuredPath.isBlank()) {
            return canonicalPath(configuredPath);
        }

        return canonicalPath(System.getProperty("user.dir"));
    }

    public static String getLibPath() {
        return new File(getAppRoot(), "lib").getPath();
    }

    public static String getDriversPath() {
        return new File(getLibPath(), "Drivers").getPath();
    }

    private static String canonicalPath(String value) {
        try {
            return new File(value).getCanonicalPath();
        } catch (IOException ex) {
            Logger
                .getLogger(RuntimePath.class.getName())
                .log(Level.WARNING, "Could not resolve Runtime path: " + value, ex);

            return new File(value).getAbsolutePath();
        }
    }
}
