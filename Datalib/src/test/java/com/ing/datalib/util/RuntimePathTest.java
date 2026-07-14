package com.ing.datalib.util;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.File;
import org.testng.annotations.Test;

public class RuntimePathTest {

    @Test
    public void appHomePropertyHasPriority() throws Exception {
        String originalAppHome = System.getProperty(RuntimePath.APP_HOME_PROPERTY);

        String configuredRoot =
            System.getProperty("java.io.tmpdir") + File.separator + "ingenious-runtime-test";

        try {
            System.setProperty(RuntimePath.APP_HOME_PROPERTY, configuredRoot);

            assertThat(RuntimePath.getAppRoot())
                .isEqualTo(new File(configuredRoot).getCanonicalPath());
        } finally {
            restoreProperty(RuntimePath.APP_HOME_PROPERTY, originalAppHome);
        }
    }

    @Test
    public void legacyFallbackUsesCurrentDirectory() throws Exception {
        String originalAppHome = System.getProperty(RuntimePath.APP_HOME_PROPERTY);

        try {
            System.clearProperty(RuntimePath.APP_HOME_PROPERTY);

            assertThat(RuntimePath.getAppRoot())
                .isEqualTo(new File(System.getProperty("user.dir")).getCanonicalPath());
        } finally {
            restoreProperty(RuntimePath.APP_HOME_PROPERTY, originalAppHome);
        }
    }

    @Test
    public void childPathsUseRuntimeRoot() {
        assertThat(RuntimePath.getLibPath())
            .isEqualTo(new File(RuntimePath.getAppRoot(), "lib").getPath());

        assertThat(RuntimePath.getDriversPath())
            .isEqualTo(new File(RuntimePath.getLibPath(), "Drivers").getPath());
    }

    private static void restoreProperty(String name, String value) {
        if (value == null) {
            System.clearProperty(name);
        } else {
            System.setProperty(name, value);
        }
    }
}
