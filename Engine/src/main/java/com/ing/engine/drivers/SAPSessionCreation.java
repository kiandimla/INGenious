
package com.ing.engine.drivers;
import com.ing.datalib.settings.emulators.Emulator;
import com.ing.engine.core.Control;
import com.ing.engine.core.RunContext;
import com.ing.engine.execution.exception.UnCaughtException;
import java.util.logging.Level;
import java.util.logging.Logger;
import com.jacob.activeX.ActiveXComponent;
/**
 *
 * @author AP01BP
 */
public class SAPSessionCreation {
	protected RunContext runContext;
	public ActiveXComponent session;
	public Process SAPProcess;

	public void launchSession(RunContext context) throws UnCaughtException {
		runContext = context;
		System.out.println("Launching " + runContext.BrowserName);
		try {
				SAPProcess = SAPSessionFactory.startSAPProcess(context, Control.getCurrentProject().getProjectSettings());
				session = SAPSessionFactory.createSAPSession(context, Control.getCurrentProject().getProjectSettings());		
		} catch (UnCaughtException ex) {
			Logger.getLogger(this.getClass().getName()).log(Level.OFF, null, ex);
			throw new UnCaughtException("[Selenium Driver Exception] Cannot Initiate Browser " + ex.getMessage());
		}
	}

	public void launchDriver(String browser) throws UnCaughtException {
		RunContext context = new RunContext();
		context.BrowserName = browser;
//		context.Browser = Browser.fromString(browser);
//		context.Platform = Platform.getCurrent();
		context.BrowserVersion = "default";
		launchSession(context);
	}

	public String getCurrentBrowser() {
		return runContext.BrowserName;
	}

	public String getDriverName(String browserName) {
		try {
			Emulator emulator = Control.getCurrentProject().getProjectSettings().getEmulators()
					.getEmulator(browserName);
			if (emulator != null) {
				return emulator.getDriver();
			}
		} catch (Exception ex) {
			Logger.getLogger(this.getClass().getName()).log(Level.OFF, null, ex);
		}
		return browserName;
	}


}
