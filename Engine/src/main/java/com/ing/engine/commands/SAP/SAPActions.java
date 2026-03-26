package com.ing.engine.commands.SAP;

import java.util.HashMap;
import java.util.Map;

import com.ing.engine.commands.browser.General;
import com.ing.engine.core.CommandControl;
import com.ing.engine.drivers.AutomationObject;
import com.ing.engine.support.Status;
import com.ing.engine.support.methodInf.Action;
import com.ing.engine.support.methodInf.InputType;
import com.ing.engine.support.methodInf.ObjectType;
import com.jacob.com.Dispatch;
import com.jacob.com.Variant;

public class SAPActions extends General {

	public SAPActions(CommandControl cc) {
		super(cc);
		// TODO Auto-generated constructor stub
	}

	@Action(object = ObjectType.SAP, desc = "Enter the value [<Data>] in the field [<Object>]", input = InputType.YES)
	public void sapFill() {
		try {
			Dispatch.put(SAPElement, "Text", Data);
			Report.updateTestLog(Action, "Entered Text '" + Data + "' on '" + ObjectName + "'", Status.DONE);
		} catch (Exception e) {
			Report.updateTestLog(Action, "Failed to Enter Text. Error : " + e.getMessage(), Status.FAILNS);
		}
	}

	@Action(object = ObjectType.SAP, desc = "Press [<Enter>] key", input = InputType.NO)
	public void sapEnter() {
		try {
			Dispatch.call(SAPElement, "sendVKey", 0);
			Report.updateTestLog(Action, "Enter key pressed successfully.", Status.DONE);
		} catch (Exception e) {
			Report.updateTestLog(Action, "Error in Enter key press. Error : " + e.getMessage(), Status.FAILNS);
		}
	}

	@Action(object = ObjectType.SAP, desc = "Click the [<Object>] ")
	public void sapClick() {
		try {
			Dispatch.call(SAPElement, "press");
			Report.updateTestLog(Action, "Clicking on [" + ObjectName +"]", Status.DONE);
		} catch (Exception e) {
			Report.updateTestLog(Action, "Failed to click. Error : " + e.getMessage(), Status.FAILNS);
		}
	}

	@Action(object = ObjectType.SAP, desc = "Double click the current Cell ")
	public void sapDoubleClickCell() {
		try {
			Dispatch.call(SAPElement, "doubleClickCurrentCell");
			Report.updateTestLog(Action, "Double Clicking on Current cell [" + ObjectName+ "]", Status.DONE);
		} catch (Exception e) {
			Report.updateTestLog(Action, "Failed to double click. Error : " + e.getMessage(), Status.FAILNS);
		}
	}

	@Action(object = ObjectType.SAP, desc = "Simulate key press with VCode [<Data>] ", input = InputType.YES)
	public void sapSimulateKeyPress() {
		try {
			Dispatch.call(SAPElement, "sendVKey", Integer.parseInt(Data));
			Report.updateTestLog(Action, "Simulate key press with VKey code [" + Data + "]", Status.DONE);
		} catch (Exception e) {
			Report.updateTestLog(Action,
					"Fails to simulate key press with VKey code [" + Data + "]. Error : " + e.getMessage(),
					Status.FAILNS);
		}
	}

	@Action(object = ObjectType.SAP, desc = "Assert that [<Object>] contains Text [<Data>]", input = InputType.YES)
	public void sapAssertElementTextContains() {
		try {
			String actualText = Dispatch.get(SAPElement, "Text").toString();
			if (actualText.contains(Data)) {
				Report.updateTestLog(Action, "["+ObjectName+
						"]actual text [" + actualText + "] contains expected text [" + Data + "].",
						Status.PASSNS);
			} else {
				Report.updateTestLog(Action,"["+ObjectName+
						"] actual text [" + actualText + "] not contains expected text [" + Data + "].", Status.FAILNS);
			}
		} catch (Exception e) {
			Report.updateTestLog(Action, "Fails to get Element text. Error : " + e.getMessage(), Status.FAILNS);
		}
	}

	@Action(object = ObjectType.SAP, desc = "Select Radio Button ", input = InputType.YES)
	public void sapSelectRadioButtonInRow() {
		try {
			Dispatch row = Dispatch.call(SAPElement, "GetAbsoluteRow", Data).toDispatch();
			Dispatch.put(row, "Selected", true);
			Report.updateTestLog(Action, "Radio button selected successfully.", Status.DONE);
		} catch (Exception e) {
			Report.updateTestLog(Action, "Fails to select radio button. Error : " + e.getMessage(), Status.FAILNS);
		}
	}

	@Action(object = ObjectType.SAP, desc = "Select checkbox ", input = InputType.NO)
	public void sapSelectCheckBox() {
		try {
			Dispatch.put(SAPElement, "Selected", true);
			Report.updateTestLog(Action, "Checkbox selected successfully.", Status.DONE);
		} catch (Exception e) {
			Report.updateTestLog(Action, "Fails to select Checkbox. Error : " + e.getMessage(), Status.FAILNS);
		}
	}

	@Action(object = ObjectType.SAP, desc = "Select the [<Object>] ")
	public void sapSelect() {
		try {
			Dispatch.call(SAPElement, "select");
			Report.updateTestLog(Action, "Select tab [" + ObjectName+"]", Status.DONE);
		} catch (Exception e) {
			Report.updateTestLog(Action, "Failed Select tab. Error : " + e.getMessage(), Status.FAILNS);
		}
	}

	@Action(object = ObjectType.SAP, desc = "Select dropdown value by visible text ", input = InputType.YES)
	public void sapSelectDropDownByText() {
		try {
			Dispatch.put(SAPElement, "Text", Data);
			Report.updateTestLog(Action, "Dropdown set with text [" + Data + "]", Status.DONE);
		} catch (Exception e) {
			Report.updateTestLog(Action, "Failed to set dropdown with text. Error : " + e.getMessage(), Status.FAILNS);
		}
	}

	@Action(object = ObjectType.SAP, desc = "Select Dropdown value by Key", input = InputType.YES)
	public void sapSelectDropDownByKey() {
		try {
			Dispatch.put(SAPElement, "Key", Data);
			Report.updateTestLog(Action, "Dropdown set with Key [" + Data + "]", Status.DONE);
		} catch (Exception e) {
			Report.updateTestLog(Action, "Failed to set dropdown with key. Error : " + e.getMessage(), Status.FAILNS);
		}
	}

	@Action(object = ObjectType.SAP, desc = "Select dropdown value by index", input = InputType.YES)
	public void sapSelectDropDownByIndex() {
		try {
			Dispatch.call(SAPElement, "Select", new Variant(Integer.parseInt(Data)));
			Report.updateTestLog(Action, "Dropdown set with index [" + Data + "]", Status.DONE);
		} catch (Exception e) {
			Report.updateTestLog(Action, "Failed to set dropdown with index . Error : " + e.getMessage(),
					Status.FAILNS);
		}
	}

	@Action(object = ObjectType.SAP, desc = "Set focus on [<Object>]", input = InputType.NO)
	public void sapSetFocus() {
		try {
			Dispatch.call(SAPElement, "setFocus");
			Report.updateTestLog(Action, "Focus has been set on [" + ObjectName+"]", Status.DONE);
		} catch (Exception e) {
			Report.updateTestLog(Action, "Failed to set focus on [" + ObjectName+"]. Error : " + e.getMessage(), Status.FAILNS);
		}
	}

	@Action(object = ObjectType.BROWSER, desc = "Close logon landscape screen", input = InputType.NO)
	public void sapCloseLogonScreen() {
		try {
			SAPProcess.destroy();
			Report.updateTestLog(Action, "Logon landscape screen closed successfully", Status.DONE);
		} catch (Exception e) {
			Report.updateTestLog(Action, "Failed to close Logon landscape screen. Error : " + e.getMessage(),
					Status.FAILNS);
		}
	}

	@Action(object = ObjectType.BROWSER, desc = "Set  all objects property to [<Data>] at runtime.", input = InputType.YES, condition = InputType.YES)
	public void sapSetglobalObjectProperty() {
		if (!Data.isEmpty()) {
			if (Condition.isEmpty()) {
				String[] groups = Data.split(",");
				for (String group : groups) {
					String[] vals = group.split("=", 2);
					AutomationObject.globalDynamicValue.put(vals[0], vals[1]);
				}
			} else {
				AutomationObject.globalDynamicValue.put(Condition, Data);
			}
			String text = String.format("Setting Global Object Property for %s with %s", Condition, Data);
			Report.updateTestLog(Action, text, Status.DONE);
		} else {
			Report.updateTestLog(Action, "Input should not be empty", Status.FAILNS);
		}
	}

	@Action(object = ObjectType.SAP, desc = "Set object [<Object>] property  as [<Data>] at runtime", input = InputType.YES, condition = InputType.YES)
	public void sapSetObjectProperty() {
		if (!Data.isEmpty()) {
			if (Condition.isEmpty()) {
				String[] groups = Data.split(",");
				for (String group : groups) {
					String[] vals = group.split("=", 2);
					setProperty(vals[0], vals[1]);
				}
			} else {
				setProperty(Condition, Data);
			}
			String text = String.format("Setting Object Property for [%s] with [%s] for Object [%s - %s]", Condition, Data,
					Reference, ObjectName);
			Report.updateTestLog(Action, text, Status.DONE);
		} else {
			Report.updateTestLog(Action, "Input should not be empty", Status.FAILNS);
		}
	}

	private void setProperty(String key, String value) {
		if (!SAPObject.dynamicValue.containsKey(Reference)) {
			Map<String, Map<String, String>> Object = new HashMap<>();
			Map<String, String> property = new HashMap<>();
			property.put(key, value);
			Object.put(ObjectName, property);
			SAPObject.dynamicValue.put(Reference, Object);
		} else if (!SAPObject.dynamicValue.get(Reference).containsKey(ObjectName)) {
			Map<String, String> property = new HashMap<>();
			property.put(key, value);
			SAPObject.dynamicValue.get(Reference).put(ObjectName, property);
		} else {
			SAPObject.dynamicValue.get(Reference).get(ObjectName).put(key, value);
		}
	}

	@Action(object = ObjectType.BROWSER, desc = "Execute SAP transaction [<Data>]", input = InputType.YES)
	public void sapExecuteTransaction() {
		try {
			Dispatch.call(SAPsession, "startTransaction", Data);
			Report.updateTestLog(Action, "Executed transaction [" + Data + "]", Status.DONE);
		} catch (Exception e) {
			Report.updateTestLog(Action, "Failed to execute transaction. Error: " + e.getMessage(), Status.FAILNS);
		}
	}

	@Action(object = ObjectType.SAP, desc = "Modify table cell with data [<Data>] in format row,column,value", input = InputType.YES)
	public void sapModifyCell() {
		try {
			String[] parts = Data.split(",", 3);
			if (parts.length < 3) {
				Report.updateTestLog(Action, "Invalid data format. Expected: row,column,value", Status.FAILNS);
				return;
			}
			int row = Integer.parseInt(parts[0].trim());
			String column = parts[1].trim();
			String value = parts[2].trim();
			
			Dispatch.call(SAPElement, "modifyCell", row, column, value);
			Report.updateTestLog(Action, "Modified cell at row " + row + ", column " + column + " with value: " + value, Status.DONE);
		} catch (Exception e) {
			Report.updateTestLog(Action, "Failed to modify cell. Error: " + e.getMessage(), Status.FAILNS);
		}
	}

	@Action(object = ObjectType.SAP, desc = "Set current table cell row to [<Data>]", input = InputType.YES)
	public void sapSetCurrentCellRow() {
		try {
			Dispatch.put(SAPElement, "currentCellRow", Integer.parseInt(Data));
			Report.updateTestLog(Action, "Set current cell row to " + Data, Status.DONE);
		} catch (Exception e) {
			Report.updateTestLog(Action, "Failed to set current cell row. Error: " + e.getMessage(), Status.FAILNS);
		}
	}

	@Action(object = ObjectType.SAP, desc = "Double click on [<Object>]")
	public void sapDoubleClick() {
		try {
			Dispatch.call(SAPElement, "doubleClick");
			Report.updateTestLog(Action, "Double clicked on [" + ObjectName + "]", Status.DONE);
		} catch (Exception e) {
			Report.updateTestLog(Action, "Failed to double click. Error: " + e.getMessage(), Status.FAILNS);
		}
	}

	@Action(object = ObjectType.SAP, desc = "Press context button with parameter [<Data>]", input = InputType.YES)
	public void sapPressContextButton() {
		try {
			if (Data != null && !Data.isEmpty()) {
				Dispatch.call(SAPElement, "pressContextButton", Data);
				Report.updateTestLog(Action, "Pressed context button with parameter [" + Data + "]", Status.DONE);
			} else {
				Dispatch.call(SAPElement, "pressContextButton");
				Report.updateTestLog(Action, "Pressed context button on [" + ObjectName + "]", Status.DONE);
			}
		} catch (Exception e) {
			Report.updateTestLog(Action, "Failed to press context button. Error: " + e.getMessage(), Status.FAILNS);
		}
	}

	@Action(object = ObjectType.SAP, desc = "Select context menu item [<Data>]", input = InputType.YES)
	public void sapSelectContextMenuItem() {
		try {
			Dispatch.call(SAPElement, "selectContextMenuItem", Data);
			Report.updateTestLog(Action, "Selected context menu item [" + Data + "]", Status.DONE);
		} catch (Exception e) {
			Report.updateTestLog(Action, "Failed to select context menu item. Error: " + e.getMessage(), Status.FAILNS);
		}
	}

	@Action(object = ObjectType.SAP, desc = "Clear selection on [<Object>]")
	public void sapClearSelection() {
		try {
			Dispatch.call(SAPElement, "clearSelection");
			Report.updateTestLog(Action, "Cleared selection on [" + ObjectName + "]", Status.DONE);
		} catch (Exception e) {
			Report.updateTestLog(Action, "Failed to clear selection. Error: " + e.getMessage(), Status.FAILNS);
		}
	}

	@Action(object = ObjectType.SAP, desc = "Resize working pane with parameters [<Data>]", input = InputType.YES)
	public void sapResizeWorkingPane() {
		try {
			String[] params = Data.split(",");
			if (params.length >= 2) {
				int width = Integer.parseInt(params[0].trim());
				int height = Integer.parseInt(params[1].trim());
				boolean fullScreen = params.length > 2 ? Boolean.parseBoolean(params[2].trim()) : false;
				
				Variant[] args = new Variant[3];
				args[0] = new Variant(width);
				args[1] = new Variant(height);
				args[2] = new Variant(fullScreen);
				
				Dispatch.call(SAPElement, "resizeWorkingPane", (Object[]) args);
				Report.updateTestLog(Action, "Resized working pane to " + width + "x" + height, Status.DONE);
			} else {
				Report.updateTestLog(Action, "Invalid data format. Expected: width,height[,fullScreen]", Status.FAILNS);
			}
		} catch (Exception e) {
			Report.updateTestLog(Action, "Failed to resize working pane. Error: " + e.getMessage(), Status.FAILNS);
		}
	}

	@Action(object = ObjectType.SAP, desc = "Set selected rows to [<Data>]", input = InputType.YES)
	public void sapSetSelectedRows() {
		try {
			Dispatch.put(SAPElement, "selectedRows", Data);
			Report.updateTestLog(Action, "Set selected rows to [" + Data + "]", Status.DONE);
		} catch (Exception e) {
			Report.updateTestLog(Action, "Failed to set selected rows. Error: " + e.getMessage(), Status.FAILNS);
		}
	}

	@Action(object = ObjectType.SAP, desc = "Set top node to [<Data>]", input = InputType.YES)
	public void sapSetTopNode() {
		try {
			Dispatch.put(SAPElement, "topNode", Data);
			Report.updateTestLog(Action, "Set top node to [" + Data + "]", Status.DONE);
		} catch (Exception e) {
			Report.updateTestLog(Action, "Failed to set top node. Error: " + e.getMessage(), Status.FAILNS);
		}
	}

	@Action(object = ObjectType.SAP, desc = "Set first visible column to [<Data>]", input = InputType.YES)
	public void sapSetFirstVisibleColumn() {
		try {
			Dispatch.put(SAPElement, "firstVisibleColumn", Data);
			Report.updateTestLog(Action, "Set first visible column to [" + Data + "]", Status.DONE);
		} catch (Exception e) {
			Report.updateTestLog(Action, "Failed to set first visible column. Error: " + e.getMessage(), Status.FAILNS);
		}
	}

	@Action(object = ObjectType.SAP, desc = "Set caret position to [<Data>]", input = InputType.YES)
	public void sapSetCaretPosition() {
		try {
			Dispatch.put(SAPElement, "caretPosition", Integer.parseInt(Data));
			Report.updateTestLog(Action, "Set caret position to " + Data, Status.DONE);
		} catch (Exception e) {
			Report.updateTestLog(Action, "Failed to set caret position. Error: " + e.getMessage(), Status.FAILNS);
		}
	}

	@Action(object = ObjectType.SAP, desc = "Set modified property to [<Data>]", input = InputType.YES)
	public void sapSetModified() {
		try {
			Dispatch.put(SAPElement, "modified", Boolean.parseBoolean(Data));
			Report.updateTestLog(Action, "Set modified property to " + Data, Status.DONE);
		} catch (Exception e) {
			Report.updateTestLog(Action, "Failed to set modified property. Error: " + e.getMessage(), Status.FAILNS);
		}
	}
}
