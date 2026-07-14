package com.ing.datalib.util;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.File;
import org.testng.annotations.Test;

public class WorkspacePathTest {

    @Test
    public void workspacePropertyHasHighestPriority() throws Exception {
        String originalWorkspace = System.getProperty(WorkspacePath.WORKSPACE_PROPERTY);

        String configuredWorkspace =
            System.getProperty("java.io.tmpdir") +
            File.separator +
            "ingenious-datalib-property-workspace";

        try {
            System.setProperty(WorkspacePath.WORKSPACE_PROPERTY, configuredWorkspace);

            assertThat(WorkspacePath.getWorkspaceRoot())
                .isEqualTo(new File(configuredWorkspace).getCanonicalPath());
        } finally {
            restoreProperty(WorkspacePath.WORKSPACE_PROPERTY, originalWorkspace);
        }
    }

    @Test
    public void legacyFallbackUsesCurrentDirectory() throws Exception {
        String originalWorkspace = System.getProperty(WorkspacePath.WORKSPACE_PROPERTY);

        String originalAppHome = System.getProperty(WorkspacePath.APP_HOME_PROPERTY);

        try {
            System.clearProperty(WorkspacePath.WORKSPACE_PROPERTY);
            System.clearProperty(WorkspacePath.APP_HOME_PROPERTY);

            assertThat(WorkspacePath.getWorkspaceRoot())
                .isEqualTo(new File(System.getProperty("user.dir")).getCanonicalPath());
        } finally {
            restoreProperty(WorkspacePath.WORKSPACE_PROPERTY, originalWorkspace);

            restoreProperty(WorkspacePath.APP_HOME_PROPERTY, originalAppHome);
        }
    }

    @Test
    public void childPathsUseWorkspaceRoot() {
        assertThat(WorkspacePath.getConfigurationPath())
            .isEqualTo(WorkspacePath.getWorkspaceRoot() + File.separator + "Configuration");

        assertThat(WorkspacePath.getProjectsPath())
            .isEqualTo(WorkspacePath.getWorkspaceRoot() + File.separator + "Projects");

        assertThat(WorkspacePath.getSharedPath())
            .isEqualTo(WorkspacePath.getWorkspaceRoot() + File.separator + "Shared");
    }

    private static void restoreProperty(String name, String value) {
        if (value == null) {
            System.clearProperty(name);
        } else {
            System.setProperty(name, value);
        }
    }
}
