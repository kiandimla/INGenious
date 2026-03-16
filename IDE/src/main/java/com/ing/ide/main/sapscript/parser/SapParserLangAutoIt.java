package com.ing.ide.main.sapscript.parser;

/**
 * SAP GUI Script parser for AutoIt (.au3) files.
 * AutoIt can access SAP GUI Scripting COM API via ObjCreate.
 * 
 * Language features:
 * - Comments: ;
 * - Session variable prefix: $
 * - Parentheses required for method calls
 * - Case insensitive
 * - Boolean values: True, False
 * 
 * Example:
 * $session.findById("wnd[0]/usr/txtRSYST-BNAME").text = "TESTUSER"
 * $session.findById("wnd[0]").sendVKey(0)
 */
public class SapParserLangAutoIt extends SapLanguageParser {
    
    @Override
    public String getLanguageName() {
        return "AutoIt";
    }
    
    @Override
    public String[] getSupportedExtensions() {
        return new String[]{"au3"};
    }
    
    @Override
    protected boolean isComment(String line) {
        return line.startsWith(";");
    }
    
    @Override
    protected String getSessionPrefix() {
        return "\\$"; // AutoIt uses $ prefix for variables
    }
}
