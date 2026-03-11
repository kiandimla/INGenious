package com.ing.ide.main.sapscript;

import com.ing.ide.main.mainui.AppMainFrame;
import org.apache.commons.io.FilenameUtils;
import org.apache.commons.lang3.StringUtils;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.xml.sax.SAXException;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.parsers.ParserConfigurationException;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerException;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import java.io.*;
import java.util.*;
import java.util.logging.Level;
import java.util.logging.Logger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parser for SAP GUI Script Tracker/Recorder VBScript files.
 * 
 * SAP GUI Script Tracker creates VBScript files containing SAP GUI scripting API calls.
 * This parser extracts:
 * - SAP object identifiers (wnd[0]/usr/txtFieldName)
 * - Text properties and values
 * - Actions (setText, press, select, doubleClick, etc.)
 * 
 * And converts them into INGenious test cases and SAP Object Repository entries.
 * 
 * Supported SAP GUI Script Commands:
 * - session.findById().text = "value"  -> Set action
 * - session.findById().press()         -> Click action
 * - session.findById().selected = true -> Select action
 * - session.findById().setFocus()      -> SetFocus action
 * - session.findById().sendVKey n      -> SendVKey action
 * - session.findById().doubleClick     -> DoubleClick action
 * - session.startTransaction "T-CODE"  -> Transaction action
 */
public class SapScriptParser {

    private static final Logger LOGGER = Logger.getLogger(SapScriptParser.class.getName());

    private final AppMainFrame sMainFrame;
    private Map<String, String> filePath = new HashMap<>();
    private Map<String, String> testCase = new HashMap<>();
    private Map<String, SapObject> sapObjects = new LinkedHashMap<>();
    private List<SapAction> sapActions = new ArrayList<>();

    // Regex patterns for SAP GUI scripting API
    private static final Pattern FIND_BY_ID_PATTERN = Pattern.compile(
            "session\\.findById\\(\"([^\"]+)\"\\)", Pattern.CASE_INSENSITIVE);
    
    private static final Pattern SET_TEXT_PATTERN = Pattern.compile(
            "session\\.findById\\(\"([^\"]+)\"\\)\\.(?:text|Text)\\s*=\\s*\"([^\"]*)\"?", Pattern.CASE_INSENSITIVE);
    
    private static final Pattern PRESS_PATTERN = Pattern.compile(
            "session\\.findById\\(\"([^\"]+)\"\\)\\.press\\(\\)", Pattern.CASE_INSENSITIVE);
    
    private static final Pattern SELECT_PATTERN = Pattern.compile(
            "session\\.findById\\(\"([^\"]+)\"\\)\\.selected\\s*=\\s*(true|false|-1|0)", Pattern.CASE_INSENSITIVE);
    
    private static final Pattern SET_FOCUS_PATTERN = Pattern.compile(
            "session\\.findById\\(\"([^\"]+)\"\\)\\.setFocus\\(\\)", Pattern.CASE_INSENSITIVE);
    
    private static final Pattern SEND_VKEY_PATTERN = Pattern.compile(
            "session\\.findById\\(\"([^\"]+)\"\\)\\.sendVKey\\s+(\\d+)", Pattern.CASE_INSENSITIVE);

    private static final Pattern DOUBLE_CLICK_PATTERN = Pattern.compile(
            "session\\.findById\\(\"([^\"]+)\"\\)\\.doubleClick", Pattern.CASE_INSENSITIVE);

    private static final Pattern TRANSACTION_PATTERN = Pattern.compile(
            "session\\.startTransaction\\s+\"([^\"]+)\"", Pattern.CASE_INSENSITIVE);

    private static final Pattern CARET_POSITION_PATTERN = Pattern.compile(
            "session\\.findById\\(\"([^\"]+)\"\\)\\.caretPosition\\s*=\\s*(\\d+)", Pattern.CASE_INSENSITIVE);

    private static final Pattern MODIFIED_CELL_PATTERN = Pattern.compile(
            "session\\.findById\\(\"([^\"]+)\"\\)\\.modifyCell\\s*\\(\\s*(\\d+)\\s*,\\s*\"([^\"]+)\"\\s*,\\s*\"([^\"]*)\"\\s*\\)", Pattern.CASE_INSENSITIVE);

    private static final Pattern SET_CURRENT_CELL_PATTERN = Pattern.compile(
            "session\\.findById\\(\"([^\"]+)\"\\)\\.currentCellRow\\s*=\\s*(\\d+)", Pattern.CASE_INSENSITIVE);

    // Additional patterns for complete SAPActions coverage
    private static final Pattern DROPDOWN_KEY_PATTERN = Pattern.compile(
            "session\\.findById\\(\"([^\"]+)\"\\)\\.(?:Key|key)\\s*=\\s*\"([^\"]*)\"?", Pattern.CASE_INSENSITIVE);
    
    private static final Pattern DROPDOWN_SELECT_PATTERN = Pattern.compile(
            "session\\.findById\\(\"([^\"]+)\"\\)\\.Select\\s*\\(?\\s*(\\d+)\\s*\\)?", Pattern.CASE_INSENSITIVE);
    
    private static final Pattern DOUBLE_CLICK_CURRENT_CELL_PATTERN = Pattern.compile(
            "session\\.findById\\(\"([^\"]+)\"\\)\\.doubleClickCurrentCell", Pattern.CASE_INSENSITIVE);
    
    private static final Pattern TAB_SELECT_PATTERN = Pattern.compile(
            "session\\.findById\\(\"([^\"]+)\"\\)\\.select\\(\\)", Pattern.CASE_INSENSITIVE);
    
    private static final Pattern COMBO_SELECTED_TEXT_PATTERN = Pattern.compile(
            "session\\.findById\\(\"([^\"]+)\"\\)\\.selected\\s*=\\s*\"([^\"]+)\"", Pattern.CASE_INSENSITIVE);

    public SapScriptParser(AppMainFrame sMainFrame) {
        this.sMainFrame = sMainFrame;
    }

    /**
     * Parse a SAP GUI Script Tracker VBS file
     */
    public void parseSapScript(File file) throws Exception {
        if (file == null || !file.exists()) {
            throw new IllegalArgumentException("SAP Script file does not exist: " + file);
        }

        try {
            System.out.println("Starting SAP Script import: " + file.getName());
            initializeFilePaths(file);
            parseScriptFile(file);
            generateObjectRepository();
            generateTestCase();
            cleanup();
            
            System.out.println("Successfully imported SAP Script: " + file.getName());
            LOGGER.info("SAP Script parsing completed successfully. Created " + sapActions.size() + " test steps.");
        } catch (Exception ex) {
            LOGGER.log(Level.SEVERE, "Error parsing SAP Script file", ex);
            System.err.println("Failed to import SAP Script: " + ex.getMessage());
            throw ex;
        }
    }

    private void initializeFilePaths(File file) {
        filePath.put("projectPath", sMainFrame.getProject().getLocation());
        filePath.put("importSapScriptFilePath", file.getAbsolutePath());
        String baseName = FilenameUtils.getBaseName(file.getName());
        testCase.put("fileName", StringUtils.capitalize(baseName));
        testCase.put("pageName", testCase.get("fileName"));
        
        // SAP Object Repository path
        filePath.put("sapORFilePath", filePath.get("projectPath") + "/OR.object");
        
        // Test scenario path
        testCase.put("testScenarioName", (filePath.get("projectPath") + "/TestPlan/" + testCase.get("fileName")).replace("\\", "/"));
        File testScenario = new File(testCase.get("testScenarioName"));
        if (!testScenario.exists()) {
            testScenario.mkdirs();
        }
        testCase.put("pageName", getUniqueName(testScenario, testCase.get("pageName")));
    }

    private void parseScriptFile(File file) throws IOException {
        LOGGER.info("Parsing SAP Script file: " + file.getAbsolutePath());
        
        try (BufferedReader reader = new BufferedReader(new FileReader(file))) {
            String line;
            int lineNumber = 0;
            String currentTransaction = null;
            
            while ((line = reader.readLine()) != null) {
                lineNumber++;
                String trimmedLine = line.trim();
                
                // Skip comments and empty lines
                if (trimmedLine.isEmpty() || trimmedLine.startsWith("'") || trimmedLine.startsWith("REM")) {
                    continue;
                }
                
                // Extract transaction
                Matcher txMatcher = TRANSACTION_PATTERN.matcher(trimmedLine);
                if (txMatcher.find()) {
                    currentTransaction = txMatcher.group(1);
                    LOGGER.fine("Found transaction: " + currentTransaction);
                    // Add transaction as an action
                    sapActions.add(new SapAction("Transaction", "SAP_SYSTEM", currentTransaction, lineNumber));
                    continue;
                }
                
                // Parse different SAP GUI actions
                parseSapAction(trimmedLine, lineNumber, currentTransaction);
            }
        }
        
        LOGGER.info(String.format("Parsed %d SAP objects and %d actions", sapObjects.size(), sapActions.size()));
    }

    private void parseSapAction(String line, int lineNumber, String transaction) {
        // Try to match setText action
        Matcher setTextMatcher = SET_TEXT_PATTERN.matcher(line);
        if (setTextMatcher.find()) {
            String id = setTextMatcher.group(1);
            String value = setTextMatcher.group(2);
            String objType = determineObjectType(id);
            addSapObject(id, objType, transaction);
            sapActions.add(new SapAction("Set", id, value, lineNumber));
            return;
        }
        
        // Try to match press action
        Matcher pressMatcher = PRESS_PATTERN.matcher(line);
        if (pressMatcher.find()) {
            String id = pressMatcher.group(1);
            addSapObject(id, "Button", transaction);
            sapActions.add(new SapAction("Click", id, "", lineNumber));
            return;
        }
        
        // Try to match dropdown key selection (must be before general select pattern)
        Matcher dropdownKeyMatcher = DROPDOWN_KEY_PATTERN.matcher(line);
        if (dropdownKeyMatcher.find()) {
            String id = dropdownKeyMatcher.group(1);
            String key = dropdownKeyMatcher.group(2);
            addSapObject(id, "ComboBox", transaction);
            sapActions.add(new SapAction("SelectDropDownByKey", id, key, lineNumber));
            return;
        }
        
        // Try to match dropdown select by index
        Matcher dropdownSelectMatcher = DROPDOWN_SELECT_PATTERN.matcher(line);
        if (dropdownSelectMatcher.find()) {
            String id = dropdownSelectMatcher.group(1);
            String index = dropdownSelectMatcher.group(2);
            addSapObject(id, "ComboBox", transaction);
            sapActions.add(new SapAction("SelectDropDownByIndex", id, index, lineNumber));
            return;
        }
        
        // Try to match combo selected with text value (e.g., cmb*.selected = "A")
        Matcher comboTextMatcher = COMBO_SELECTED_TEXT_PATTERN.matcher(line);
        if (comboTextMatcher.find()) {
            String id = comboTextMatcher.group(1);
            String value = comboTextMatcher.group(2);
            String objType = determineObjectType(id);
            if (objType.equals("ComboBox")) {
                addSapObject(id, "ComboBox", transaction);
                sapActions.add(new SapAction("SelectDropDownByText", id, value, lineNumber));
                return;
            }
        }
        
        // Try to match select action (checkbox, radio, tab) - now with type detection
        Matcher selectMatcher = SELECT_PATTERN.matcher(line);
        if (selectMatcher.find()) {
            String id = selectMatcher.group(1);
            String selected = selectMatcher.group(2);
            String objType = determineObjectType(id);
            
            // Determine action based on object type
            if (objType.equals("Checkbox")) {
                addSapObject(id, "Checkbox", transaction);
                sapActions.add(new SapAction("SelectCheckBox", id, selected, lineNumber));
            } else if (objType.equals("RadioButton")) {
                addSapObject(id, "RadioButton", transaction);
                sapActions.add(new SapAction("SelectRadioButton", id, selected, lineNumber));
            } else if (objType.equals("Tab")) {
                addSapObject(id, "Tab", transaction);
                sapActions.add(new SapAction("SelectTab", id, selected, lineNumber));
            } else {
                addSapObject(id, objType, transaction);
                sapActions.add(new SapAction("Select", id, selected, lineNumber));
            }
            return;
        }
        
        // Try to match tab select() method call
        Matcher tabSelectMatcher = TAB_SELECT_PATTERN.matcher(line);
        if (tabSelectMatcher.find()) {
            String id = tabSelectMatcher.group(1);
            addSapObject(id, "Tab", transaction);
            sapActions.add(new SapAction("SelectTab", id, "", lineNumber));
            return;
        }
        
        // Try to match setFocus action
        Matcher focusMatcher = SET_FOCUS_PATTERN.matcher(line);
        if (focusMatcher.find()) {
            String id = focusMatcher.group(1);
            addSapObject(id, "Element", transaction);
            sapActions.add(new SapAction("SetFocus", id, "", lineNumber));
            return;
        }
        
        // Try to match sendVKey action
        Matcher vkeyMatcher = SEND_VKEY_PATTERN.matcher(line);
        if (vkeyMatcher.find()) {
            String id = vkeyMatcher.group(1);
            String vkey = vkeyMatcher.group(2);
            addSapObject(id, "Window", transaction);
            sapActions.add(new SapAction("SendVKey", id, vkey, lineNumber));
            return;
        }
        
        // Try to match double click on current cell (specific pattern)
        Matcher doubleClickCellMatcher = DOUBLE_CLICK_CURRENT_CELL_PATTERN.matcher(line);
        if (doubleClickCellMatcher.find()) {
            String id = doubleClickCellMatcher.group(1);
            addSapObject(id, "Table", transaction);
            sapActions.add(new SapAction("DoubleClickCell", id, "", lineNumber));
            return;
        }
        
        // Try to match general doubleClick action
        Matcher doubleClickMatcher = DOUBLE_CLICK_PATTERN.matcher(line);
        if (doubleClickMatcher.find()) {
            String id = doubleClickMatcher.group(1);
            addSapObject(id, "Element", transaction);
            sapActions.add(new SapAction("DoubleClick", id, "", lineNumber));
            return;
        }

        // Try to match modifyCell action (for table operations)
        Matcher modifyCellMatcher = MODIFIED_CELL_PATTERN.matcher(line);
        if (modifyCellMatcher.find()) {
            String id = modifyCellMatcher.group(1);
            String row = modifyCellMatcher.group(2);
            String column = modifyCellMatcher.group(3);
            String value = modifyCellMatcher.group(4);
            addSapObject(id, "Table", transaction);
            sapActions.add(new SapAction("ModifyCell", id, row + "," + column + "," + value, lineNumber));
            return;
        }

        // Try to match setCurrentCell action
        Matcher setCurrentCellMatcher = SET_CURRENT_CELL_PATTERN.matcher(line);
        if (setCurrentCellMatcher.find()) {
            String id = setCurrentCellMatcher.group(1);
            String row = setCurrentCellMatcher.group(2);
            addSapObject(id, "Table", transaction);
            sapActions.add(new SapAction("SetCurrentCell", id, row, lineNumber));
            return;
        }
        
        // Generic findById for objects not yet handled
        Matcher findByIdMatcher = FIND_BY_ID_PATTERN.matcher(line);
        if (findByIdMatcher.find()) {
            String id = findByIdMatcher.group(1);
            addSapObject(id, "Element", transaction);
        }
    }

    private void addSapObject(String id, String type, String transaction) {
        if (!sapObjects.containsKey(id)) {
            sapObjects.put(id, new SapObject(id, type, transaction));
            LOGGER.fine(String.format("Added SAP object: id=%s, type=%s", id, type));
        }
    }
    
    /**
     * Determine object type based on SAP ID prefix for better action mapping.
     * Maps SAP control prefixes to appropriate object types that align with SAPActions.
     */
    private String determineObjectType(String sapId) {
        // Extract the last segment after the final '/'
        String lastSegment = sapId;
        int lastSlash = sapId.lastIndexOf('/');
        if (lastSlash >= 0) {
            lastSegment = sapId.substring(lastSlash + 1);
        }
        
        // Determine type based on common SAP GUI control prefixes
        if (lastSegment.startsWith("txt") || lastSegment.startsWith("ctxt")) {
            return "TextField";
        }
        if (lastSegment.startsWith("pwd")) {
            return "PasswordField";
        }
        if (lastSegment.startsWith("btn")) {
            return "Button";
        }
        if (lastSegment.startsWith("chk")) {
            return "Checkbox";
        }
        if (lastSegment.startsWith("rad")) {
            return "RadioButton";
        }
        if (lastSegment.startsWith("cmb") || lastSegment.startsWith("cbo")) {
            return "ComboBox";
        }
        if (lastSegment.startsWith("tbl")) {
            return "Table";
        }
        if (lastSegment.startsWith("tab")) {
            return "Tab";
        }
        if (lastSegment.startsWith("wnd")) {
            return "Window";
        }
        if (lastSegment.startsWith("usr") || lastSegment.startsWith("sub")) {
            return "Container"; // Container elements, usually skip
        }
        
        return "Element"; // Default for unknown types
    }

    private void generateObjectRepository() throws Exception {
        File sapORFile = new File(filePath.get("sapORFilePath"));
        
        if (!sapORFile.exists()) {
            createNewSapOR(sapORFile);
        } else {
            updateExistingSapOR(sapORFile);
        }
    }

    private void createNewSapOR(File sapORFile) throws Exception {
        LOGGER.info("Creating new SAP Object Repository");
        
        DocumentBuilderFactory dbFactory = DocumentBuilderFactory.newInstance();
        DocumentBuilder dBuilder = dbFactory.newDocumentBuilder();
        Document doc = dBuilder.newDocument();
        
        // Root element
        Element rootElement = doc.createElement("Root");
        doc.appendChild(rootElement);
        rootElement.setAttribute("ref", testCase.get("fileName"));
        rootElement.setAttribute("type", "OR");
        
        // Create page
        Element page = createSapORPage(doc);
        rootElement.appendChild(page);
        
        // Save document
        saveXMLDocument(doc, sapORFile);
    }

    private void updateExistingSapOR(File sapORFile) throws Exception {
        LOGGER.info("Updating existing SAP Object Repository");
        
        DocumentBuilderFactory documentBuilderFactory = DocumentBuilderFactory.newInstance();
        DocumentBuilder documentBuilder = documentBuilderFactory.newDocumentBuilder();
        Document doc = documentBuilder.parse(sapORFile);
        doc.getDocumentElement().normalize();
        Element root = doc.getDocumentElement();
        
        // Create new page
        Element page = createSapORPage(doc);
        root.appendChild(page);
        
        // Save document
        saveXMLDocument(doc, sapORFile);
    }

    private Element createSapORPage(Document doc) {
        Element page = doc.createElement("Page");
        page.setAttribute("ref", testCase.get("pageName"));
        
        // Group objects by type
        Map<String, List<SapObject>> groupedObjects = new LinkedHashMap<>();
        for (SapObject obj : sapObjects.values()) {
            groupedObjects.computeIfAbsent(obj.type, k -> new ArrayList<>()).add(obj);
        }
        
        // Create object groups
        for (Map.Entry<String, List<SapObject>> entry : groupedObjects.entrySet()) {
            Element objectGroup = doc.createElement("ObjectGroup");
            objectGroup.setAttribute("ref", entry.getKey());
            
            for (SapObject sapObj : entry.getValue()) {
                Element object = createSapORObject(doc, sapObj, objectGroup);
                objectGroup.appendChild(object);
            }
            
            page.appendChild(objectGroup);
        }
        
        return page;
    }

    private Element createSapORObject(Document doc, SapObject sapObj, Element objectGroup) {
        String objectName = generateObjectName(sapObj.id);
        
        Element object = doc.createElement("Object");
        object.setAttribute("ref", objectName);
        object.setAttribute("frame", "");
        
        // Add id property (SAP ID path)
        Element idProp = doc.createElement("Property");
        idProp.setAttribute("ref", "SAPId");
        idProp.setAttribute("value", sapObj.id);
        idProp.setAttribute("pref", "1");
        object.appendChild(idProp);
        
        // Add Text property (extracted from ID if available)
        String extractedText = extractTextFromId(sapObj.id);
        if (extractedText != null && !extractedText.isEmpty()) {
            Element textProp = doc.createElement("Property");
            textProp.setAttribute("ref", "Text");
            textProp.setAttribute("value", extractedText);
            textProp.setAttribute("pref", "2");
            object.appendChild(textProp);
        }
        
        return object;
    }

    private void generateTestCase() throws IOException {
        LOGGER.info("Generating test case from SAP actions");
        
        String testCasePath = testCase.get("testScenarioName") + "/" + testCase.get("pageName") + ".csv";
        File testCaseFile = new File(testCasePath);
        
        try (PrintWriter writer = new PrintWriter(testCaseFile)) {
            int stepNo = 1;
            
            for (SapAction action : sapActions) {
                if (action.actionType.equals("Transaction")) {
                    // Transaction action - no object reference needed
                    String stepName = "Execute Transaction " + action.value;
                    writer.println(String.format("%d,%s,%s,%s,%s,%s,%s", 
                        stepNo++, stepName, "", "executeTransaction", action.value, "", ""));
                } else {
                    String objectName = generateObjectName(action.objectId);
                    String stepName = action.actionType + " " + objectName;
                    String sapAction = mapToINGeniousAction(action.actionType);
                    String object = testCase.get("pageName") + ":" + objectName;
                    String data = escapeCSV(action.value);
                    
                    writer.println(String.format("%d,%s,%s,%s,%s,%s,%s", 
                        stepNo++, stepName, "", sapAction, data, "", object));
                }
            }
        }
        
        LOGGER.info("Test case generated: " + testCaseFile.getAbsolutePath());
        System.out.println("Created test case with " + sapActions.size() + " steps");
    }

    private String mapToINGeniousAction(String sapActionType) {
        switch (sapActionType.toLowerCase()) {
            case "set":
                return "sapFill";
            case "click":
            case "press":
                return "sapClick";
            case "select":
                return "sapSelect";
            case "selectcheckbox":
                return "sapSelectCheckBox";
            case "selectradiobutton":
                return "sapSelectRadioButtonInRow";
            case "selecttab":
                return "sapSelect";
            case "selectdropdownbytext":
                return "sapSelectDropDownByText";
            case "selectdropdownbykey":
                return "sapSelectDropDownByKey";
            case "selectdropdownbyindex":
                return "sapSelectDropDownByIndex";
            case "setfocus":
                return "sapSetFocus";
            case "sendvkey":
                return "sapSimulateKeyPress";
            case "doubleclick":
                return "sapDoubleClick";
            case "doubleclickcell":
                return "sapDoubleClickCell";
            case "modifycell":
                return "sapModifyCell";
            case "setcurrentcell":
                return "sapSetCurrentCellRow";
            case "transaction":
                return "sapExecuteTransaction";
            default:
                return "Interact";
        }
    }

    private String generateObjectName(String id) {
        // Extract readable name from SAP ID
        // Example: wnd[0]/usr/txtRSYST-BNAME -> RSYST_BNAME
        String name = id;
        
        // Get last segment after final /
        int lastSlash = name.lastIndexOf('/');
        if (lastSlash >= 0) {
            name = name.substring(lastSlash + 1);
        }
        
        // Remove prefixes like txt, btn, cbo, chk, tbl, tab, etc.
        name = name.replaceAll("^(txt|btn|cbo|chk|tbl|tab|usr|wnd|sub|ctxt|cmbBox|rad)", "");
        
        // Replace - with _
        name = name.replace("-", "_");
        
        // Remove brackets and special characters
        name = name.replaceAll("[\\[\\]()]", "");
        
        // Remove other special characters
        name = name.replaceAll("[^a-zA-Z0-9_]", "");
        
        // Ensure it starts with a letter
        if (!name.isEmpty() && !Character.isLetter(name.charAt(0))) {
            name = "obj_" + name;
        }
        
        // If empty, generate generic name
        if (name.isEmpty()) {
            name = "SAPObject_" + (sapObjects.size() + 1);
        }
        
        return name;
    }

    private String extractTextFromId(String id) {
        // Try to extract meaningful text from SAP ID
        // Example: wnd[0]/usr/txtRSYST-BNAME -> RSYST-BNAME
        String[] parts = id.split("/");
        if (parts.length > 0) {
            String lastPart = parts[parts.length - 1];
            // Remove control type prefix
            return lastPart.replaceAll("^(txt|btn|cbo|chk|tbl|tab|ctxt|cmbBox|rad)", "");
        }
        return "";
    }

    private String getUniqueName(File directory, String baseName) {
        String uniqueName = baseName;
        int counter = 1;
        File testFile = new File(directory, uniqueName + ".csv");
        
        while (testFile.exists()) {
            uniqueName = baseName + "_" + counter;
            testFile = new File(directory, uniqueName + ".csv");
            counter++;
        }
        
        return uniqueName;
    }

    private void saveXMLDocument(Document doc, File file) throws TransformerException {
        TransformerFactory transformerFactory = TransformerFactory.newInstance();
        Transformer transformer = transformerFactory.newTransformer();
        transformer.setOutputProperty(javax.xml.transform.OutputKeys.INDENT, "yes");
        transformer.setOutputProperty("{http://xml.apache.org/xslt}indent-amount", "2");
        
        DOMSource source = new DOMSource(doc);
        StreamResult result = new StreamResult(file);
        transformer.transform(source, result);
        
        LOGGER.info("SAP OR saved to: " + file.getAbsolutePath());
    }

    private String escapeCSV(String value) {
        if (value == null) {
            return "";
        }
        if (value.contains(",") || value.contains("\"") || value.contains("\n")) {
            return "\"" + value.replace("\"", "\"\"") + "\"";
        }
        return value;
    }

    private void cleanup() {
        sapObjects.clear();
        sapActions.clear();
        testCase.clear();
        filePath.clear();
    }

    // -------- Inner Classes --------

    static class SapObject {
        String id;
        String type;
        String text;
        String transaction;

        SapObject(String id, String type, String transaction) {
            this.id = id;
            this.type = type;
            this.transaction = transaction;
            this.text = "";
        }
    }

    static class SapAction {
        String actionType;
        String objectId;
        String value;
        int lineNumber;

        SapAction(String actionType, String objectId, String value, int lineNumber) {
            this.actionType = actionType;
            this.objectId = objectId;
            this.value = value;
            this.lineNumber = lineNumber;
        }
    }
}
