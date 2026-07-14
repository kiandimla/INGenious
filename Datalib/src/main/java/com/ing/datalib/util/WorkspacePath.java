package com.ing.datalib.util;

import java.io.File;
import java.io.IOException;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Resolves the external, writable INGenious Workspace.
 *
 * <p>This class belongs to Datalib so both Datalib and Engine can use the same
 * Workspace resolution without introducing a dependency cycle.
 */
public final class WorkspacePath {
    public static final String WORKSPACE_PROPERTY = "ingenious.workspace";
    public static final String WORKSPACE_ENVIRONMENT = "INGENIOUS_WORKSPACE";
    public static final String APP_HOME_PROPERTY = "ingenious.app.home";

    private WorkspacePath() {}

    /**
     * Resolves the Workspace using the following precedence:
     *
     * <ol>
     *   <li>The ingenious.workspace system property</li>
     *   <li>The INGENIOUS_WORKSPACE environment variable</li>
     *   <li>The packaged-application user Workspace fallback</li>
     *   <li>The current directory for legacy compatibility</li>
     * </ol>
     *
     * @return canonical absolute Workspace path
     */
    public static String getWorkspaceRoot() {
        String configuredPath = System.getProperty(WORKSPACE_PROPERTY);

        if (configuredPath != null && !configuredPath.isBlank()) {
            return canonicalPath(configuredPath);
        }

        String environmentPath = System.getenv(WORKSPACE_ENVIRONMENT);

        if (environmentPath != null && !environmentPath.isBlank()) {
            return canonicalPath(environmentPath);
        }

        String appHome = System.getProperty(APP_HOME_PROPERTY);

        if (appHome != null && !appHome.isBlank()) {
            return canonicalPath(
                System.getProperty("user.home") +
                File.separator +
                "INGenious" +
                File.separator +
                "Workspace"
            );
        }

        return canonicalPath(System.getProperty("user.dir"));
    }

    public static String getConfigurationPath() {
        return getWorkspaceRoot() + File.separator + "Configuration";
    }

    public static String getProjectsPath() {
        return getWorkspaceRoot() + File.separator + "Projects";
    }

    public static String getSharedPath() {
        return getWorkspaceRoot() + File.separator + "Shared";
    }

    private static String canonicalPath(String value) {
        try {
            return new File(value).getCanonicalPath();
        } catch (IOException ex) {
            Logger
                .getLogger(WorkspacePath.class.getName())
                .log(Level.WARNING, "Could not resolve Workspace path: " + value, ex);

            return new File(value).getAbsolutePath();
        }
    }
}
