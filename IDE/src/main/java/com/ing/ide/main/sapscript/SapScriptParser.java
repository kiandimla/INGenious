package com.ing.ide.main.sapscript;

import com.ing.ide.main.mainui.AppMainFrame;
import com.ing.ide.main.sapscript.parser.SapLanguageParser;
import com.ing.ide.main.sapscript.parser.SapParserFactory;
import org.apache.commons.io.FilenameUtils;
import org.apache.commons.lang3.StringUtils;
import org.w3c.dom.Document;
import org.w3c.dom.Element;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerException;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import java.io.*;
import java.util.*;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Main orchestrator for SAP GUI Script parsing with language-specific parser delegation.
 * 
 * This class uses language-specific parsers to extract SAP GUI commands from various
 * scripting languages and converts them into INGenious test cases and SAP Object Repository entries.
 * 
 * Supported Languages:
 * - VBScript (.vbs, .vba) - SAP Script Tracker native format
 * - JavaScript (.js) - SAP Script Tracker native format  
 * - PowerShell (.ps1) - Windows automation via COM
 * - Python (.py) - Automation via win32com/pywin32
 * - AutoIt (.au3) - Automation scripting
 * 
 * Architecture:
 * 1. SapParserFactory selects the appropriate language parser based on file extension
 * 2. Language-specific parser extracts SAP objects and actions
 * 3. SapScriptParser generates Object Repository (XML) and Test Cases (CSV)
 */
public class SapScriptParser {

    private static final Logger LOGGER = Logger.getLogger(SapScriptParser.class.getName());

    private final AppMainFrame sMainFrame;
    private final Map<String, String> filePath = new HashMap<>();
    private final Map<String, String> testCase = new HashMap<>();
    private Map<String, SapLanguageParser.SapObject> sapObjects = new LinkedHashMap<>();
    private List<SapLanguageParser.SapAction> sapActions = new ArrayList<>();
    
    // Track used object names to avoid duplicates
    private final Set<String> usedObjectNames = new HashSet<>();
    
    // Map from original object ID to generated unique name (to ensure consistency)
    private final Map<String, String> objectIdToNameCache = new HashMap<>();

    public SapScriptParser(AppMainFrame sMainFrame) {
        this.sMainFrame = sMainFrame;
    }
    
    /**
     * Validate input file before parsing.
     * Checks file size, readability, and content.
     */
    private void validateInputFile(File file) throws IOException {
        // Check file size
        long fileSize = file.length();
        if (fileSize > SapParserConstants.MAX_FILE_SIZE_BYTES) {
            throw new IllegalArgumentException(
                String.format("File too large: %.2f MB. Maximum size: %s", 
                    fileSize / (1024.0 * 1024.0), 
                    SapParserConstants.MAX_FILE_SIZE_DISPLAY));
        }
        
        // Check file is readable
        if (!file.canRead()) {
            throw new IOException("Cannot read file: " + file.getAbsolutePath() + 
                ". Check file permissions.");
        }
        
        // Check not empty
        if (fileSize == 0) {
            throw new IllegalArgumentException("File is empty: " + file.getName());
        }
        
        LOGGER.fine(String.format("File validation passed: %s (%.2f KB)", 
            file.getName(), fileSize / 1024.0));
    }

    /**
     * Parse a SAP GUI Script file (VBScript, JavaScript, PowerShell, Python, AutoIt, or custom).
     * The parser is language-agnostic and extracts SAP COM API calls regardless of source language.
     */
    public void parseSapScript(File file) throws Exception {
        if (file == null || !file.exists()) {
            throw new IllegalArgumentException("SAP Script file does not exist: " + file);
        }
        
        // Validate file before processing
        validateInputFile(file);
        
        String extension = FilenameUtils.getExtension(file.getName()).toLowerCase();
        if (!SapParserFactory.isSupported(extension)) {
            LOGGER.warning(String.format("File extension '%s' is uncommon for SAP scripts. Supported: %s", 
                extension, SapParserFactory.getSupportedExtensions()));
        }

        try {
            System.out.println("Starting SAP Script import: " + file.getName());
            initializeFilePaths(file);
            
            // Clear object name tracking for new parse
            usedObjectNames.clear();
            objectIdToNameCache.clear();
            
            // Use factory to get language-specific parser
            SapLanguageParser languageParser = SapParserFactory.createParser(file);
            System.out.println("Using " + languageParser.getLanguageName() + " parser");
            
            // Parse the script file
            languageParser.parse(file);
            
            // Get parsed objects and actions
            sapObjects = languageParser.getSapObjects();
            sapActions = languageParser.getSapActions();
            
            generateObjectRepository();
            generateTestCase();
            cleanup();
            
            System.out.println("Successfully imported SAP Script: " + file.getName());
            LOGGER.info(String.format("SAP Script parsing completed successfully. Created %d test steps.", sapActions.size()));
        } catch (IOException ex) {
            String errorMsg = "Cannot read SAP script file: " + file.getName() + 
                ". Ensure file exists and is readable.";
            LOGGER.log(Level.SEVERE, errorMsg, ex);
            System.err.println("File Error: " + errorMsg);
            throw new IOException(errorMsg, ex);
        } catch (IllegalArgumentException ex) {
            String errorMsg = "Invalid SAP script format in file: " + file.getName() + 
                ". " + ex.getMessage();
            LOGGER.log(Level.SEVERE, errorMsg, ex);
            System.err.println("Validation Error: " + errorMsg);
            throw new IllegalArgumentException(errorMsg, ex);
        } catch (Exception ex) {
            String errorMsg = "Unexpected error importing SAP script: " + file.getName() + 
                ". " + ex.getMessage();
            LOGGER.log(Level.SEVERE, errorMsg, ex);
            System.err.println("Import Error: " + errorMsg);
            throw new Exception(errorMsg, ex);
        }
    }

    private void initializeFilePaths(File file) {
        filePath.put("projectPath", sMainFrame.getProject().getLocation());
        filePath.put("importSapScriptFilePath", file.getAbsolutePath());
        String baseName = FilenameUtils.getBaseName(file.getName());
        testCase.put("fileName", StringUtils.capitalize(baseName));
        testCase.put("pageName", testCase.get("fileName"));
        
        // SAP Object Repository path
        filePath.put("sapORFilePath", filePath.get("projectPath") + "/SapOR.object");
        
        // Test scenario path
        testCase.put("testScenarioName", (filePath.get("projectPath") + "/TestPlan/" + testCase.get("fileName")).replace("\\", "/"));
        File testScenario = new File(testCase.get("testScenarioName"));
        if (!testScenario.exists()) {
            testScenario.mkdirs();
        }
        testCase.put("pageName", getUniqueName(testScenario, testCase.get("pageName")));
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
        rootElement.setAttribute("type", "SapOR");
        rootElement.setAttribute("scope", "PROJECT");
        
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
        
        // Create one ObjectGroup per SAP object (not grouped by type)
        for (SapLanguageParser.SapObject sapObj : sapObjects.values()) {
            String objectName = generateUniqueObjectName(sapObj.id);
            
            // Create ObjectGroup with the object name as ref
            Element objectGroup = doc.createElement("ObjectGroup");
            objectGroup.setAttribute("ref", objectName);
            
            // Create Object with the same name as ref
            Element object = createSapORObject(doc, sapObj, objectName);
            objectGroup.appendChild(object);
            
            page.appendChild(objectGroup);
        }
        
        return page;
    }

    private Element createSapORObject(Document doc, SapLanguageParser.SapObject sapObj, String objectName) {
        
        Element object = doc.createElement("Object");
        object.setAttribute("ref", objectName);
        object.setAttribute("frame", "");
        
        // SAP Object Repository only has 3 properties (from SapOR.OBJECT_PROPS):
        // 1. id - SAP findById path (always required)
        // 2. name - Object name (only if not empty)
        // 3. Text - Text value (only if captured from script)
        
        int propIndex = 1;
        
        // Property 1: id (SAP findById path) - always required
        Element idProp = doc.createElement("Property");
        idProp.setAttribute("ref", "id");
        idProp.setAttribute("value", sapObj.id);
        idProp.setAttribute("pref", String.valueOf(propIndex++));
        object.appendChild(idProp);
        
        // Property 2: name (only add if not empty)
        if (sapObj.name != null && !sapObj.name.isEmpty()) {
            Element nameProp = doc.createElement("Property");
            nameProp.setAttribute("ref", "name");
            nameProp.setAttribute("value", sapObj.name);
            nameProp.setAttribute("pref", String.valueOf(propIndex++));
            object.appendChild(nameProp);
        }
        
        // Property 3: Text (only add if captured from script)
        if (sapObj.text != null && !sapObj.text.isEmpty()) {
            Element textProp = doc.createElement("Property");
            textProp.setAttribute("ref", "Text");
            textProp.setAttribute("value", sapObj.text);
            textProp.setAttribute("pref", String.valueOf(propIndex++));
            object.appendChild(textProp);
        }
        
        return object;
    }

    private void generateTestCase() throws IOException {
        LOGGER.info("Generating test case from SAP actions");
        
        String testCasePath = testCase.get("testScenarioName") + "/" + testCase.get("pageName") + ".csv";
        File testCaseFile = new File(testCasePath);
        
        try (PrintWriter writer = new PrintWriter(testCaseFile)) {
            // Write CSV header
            writer.println("Step,ObjectName,Description,Action,Input,Condition,Reference");

            int stepNo = 1;

            for (SapLanguageParser.SapAction action : sapActions) {
                if (action.actionType.equals("Transaction")) {
                    // Transaction action - no object reference needed
                    String stepName = "Execute Transaction " + action.value;
                    writer.println(String.format("%d,%s,%s,%s,%s,%s,%s",
                        stepNo++, "SAP_SYSTEM", stepName, "executeTransaction", action.value, "", ""));
                } else {
                    String objectName = generateUniqueObjectName(action.objectId);
                    String stepName = action.actionType + " [<Object>]";
                    String sapAction = mapToINGeniousAction(action.actionType);
                    String reference = "[Project] " + testCase.get("pageName");

                    // Add @ prefix whenever there's a value to reference static value from object
                    String data = action.value;
                    if (data != null && !data.isEmpty()) {
                        data = "@" + data;
                    }
                    data = escapeCSV(data);
                    
                    writer.println(String.format("%d,%s,%s,%s,%s,%s,%s",
                        stepNo++, objectName, stepName, sapAction, data, "", reference));
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
            case "doubleclickcurrentcell":
                return "sapDoubleClickCell";
            case "modifycell":
                return "sapModifyCell";
            case "setcurrentcell":
            case "currentcellrow":
                return "sapSetCurrentCellRow";
            case "transaction":
                return "sapExecuteTransaction";
            case "presscontextbutton":
                return "sapPressContextButton";
            case "selectcontextmenuitem":
                return "sapSelectContextMenuItem";
            case "clearselection":
                return "sapClearSelection";
            case "resizeworkingpane":
                return "sapResizeWorkingPane";
            case "selectedrows":
                return "sapSetSelectedRows";
            case "topnode":
                return "sapSetTopNode";
            case "firstvisiblecolumn":
                return "sapSetFirstVisibleColumn";
            case "caretposition":
            case "cursorposition":
                return "sapSetCaretPosition";
            case "modified":
                return "sapSetModified";
            case "check":
                return "sapSelectCheckBox";
            case "dropdownkey":
                return "sapSelectDropDownByKey";
            // Handle dynamic property setters
            default:
                if (sapActionType.toLowerCase().startsWith("setproperty_")) {
                    return "manual_review";
                }
                return "manual_review";
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
        
        // Keep prefixes (txt, btn, cbo, etc.) for clarity and SAP convention alignment
        
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
    
    /**
     * Generate a unique object name, handling collisions by appending a counter.
     * Prevents duplicate object names in the Object Repository.
     * Uses caching to ensure the same ID always returns the same unique name.
     */
    private String generateUniqueObjectName(String id) {
        // Check cache first - return cached name if already generated
        if (objectIdToNameCache.containsKey(id)) {
            return objectIdToNameCache.get(id);
        }
        
        String baseName = generateObjectName(id);
        String uniqueName = baseName;
        int counter = 1;
        
        // Ensure uniqueness
        while (usedObjectNames.contains(uniqueName)) {
            uniqueName = baseName + "_" + counter++;
        }
        
        usedObjectNames.add(uniqueName);
        objectIdToNameCache.put(id, uniqueName);
        LOGGER.fine("Generated unique object name: " + uniqueName + " from " + id);
        return uniqueName;
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
}
