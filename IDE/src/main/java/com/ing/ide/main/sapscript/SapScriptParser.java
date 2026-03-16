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

    public SapScriptParser(AppMainFrame sMainFrame) {
        this.sMainFrame = sMainFrame;
    }

    /**
     * Parse a SAP GUI Script file (VBScript, JavaScript, PowerShell, Python, AutoIt, or custom).
     * The parser is language-agnostic and extracts SAP COM API calls regardless of source language.
     */
    public void parseSapScript(File file) throws Exception {
        if (file == null || !file.exists()) {
            throw new IllegalArgumentException("SAP Script file does not exist: " + file);
        }
        
        String extension = FilenameUtils.getExtension(file.getName()).toLowerCase();
        if (!SapParserFactory.isSupported(extension)) {
            LOGGER.warning(String.format("File extension '%s' is uncommon for SAP scripts. Supported: %s", 
                extension, SapParserFactory.getSupportedExtensions()));
        }

        try {
            System.out.println("Starting SAP Script import: " + file.getName());
            initializeFilePaths(file);
            
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
        
        // Group objects by type
        Map<String, List<SapLanguageParser.SapObject>> groupedObjects = new LinkedHashMap<>();
        for (SapLanguageParser.SapObject obj : sapObjects.values()) {
            groupedObjects.computeIfAbsent(obj.type, k -> new ArrayList<>()).add(obj);
        }
        
        // Create object groups
        for (Map.Entry<String, List<SapLanguageParser.SapObject>> entry : groupedObjects.entrySet()) {
            Element objectGroup = doc.createElement("ObjectGroup");
            objectGroup.setAttribute("ref", entry.getKey());
            
            for (SapLanguageParser.SapObject sapObj : entry.getValue()) {
                Element object = createSapORObject(doc, sapObj, objectGroup);
                objectGroup.appendChild(object);
            }
            
            page.appendChild(objectGroup);
        }
        
        return page;
    }

    private Element createSapORObject(Document doc, SapLanguageParser.SapObject sapObj, Element objectGroup) {
        String objectName = generateObjectName(sapObj.id);
        
        Element object = doc.createElement("Object");
        object.setAttribute("ref", objectName);
        object.setAttribute("frame", "");
        
        int propIndex = 1;
        
        // Add id property (SAP ID path) - always first
        Element idProp = doc.createElement("Property");
        idProp.setAttribute("ref", "id");
        idProp.setAttribute("value", sapObj.id);
        idProp.setAttribute("pref", String.valueOf(propIndex++));
        object.appendChild(idProp);
        
        // Add text property ONLY if explicitly captured from script
        if (sapObj.text != null && !sapObj.text.isEmpty()) {
            Element textProp = doc.createElement("Property");
            textProp.setAttribute("ref", "Text");
            textProp.setAttribute("value", sapObj.text);
            textProp.setAttribute("pref", String.valueOf(propIndex++));
            object.appendChild(textProp);
        }
        
        // Add name property if available
        if (sapObj.name != null && !sapObj.name.isEmpty()) {
            Element nameProp = doc.createElement("Property");
            nameProp.setAttribute("ref", "name");
            nameProp.setAttribute("value", sapObj.name);
            nameProp.setAttribute("pref", String.valueOf(propIndex++));
            object.appendChild(nameProp);
        }
        
        // Add any additional properties captured from the script
        for (Map.Entry<String, String> entry : sapObj.additionalProperties.entrySet()) {
            Element additionalProp = doc.createElement("Property");
            additionalProp.setAttribute("ref", entry.getKey());
            additionalProp.setAttribute("value", entry.getValue());
            additionalProp.setAttribute("pref", String.valueOf(propIndex++));
            object.appendChild(additionalProp);
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
                    String objectName = generateObjectName(action.objectId);
                    String stepName = action.actionType + " [<Object>]";
                    String sapAction = mapToINGeniousAction(action.actionType);
                    String reference = "[Project] " + testCase.get("pageName");

                    String data = escapeCSV(action.value);
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
