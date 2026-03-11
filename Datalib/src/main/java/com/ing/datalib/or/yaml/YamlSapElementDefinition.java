package com.ing.datalib.or.yaml;

import com.ing.datalib.or.common.ORAttribute;
import com.ing.datalib.or.common.ObjectGroup;
import com.ing.datalib.or.sap.SapOR;
import com.ing.datalib.or.sap.SapORObject;
import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;

import java.util.Objects;

/**
 * YAML representation of a SAP OR element.
 * 
 * Example YAML output:
 * <pre>
 * elements:
 *   usernameField:
 *     id: wnd[0]/usr/txtRSYST-BNAME
 *     text: User Name
 *   passwordField:
 *     id: wnd[0]/usr/pwdRSYST-BCODE
 *   loginButton:
 *     id: wnd[0]/usr/btnLOGIN
 *     text: Enter
 * </pre>
 */
@JsonInclude(JsonInclude.Include.NON_EMPTY)
@JsonPropertyOrder({"id", "text"})
public class YamlSapElementDefinition {
    
    private String id;
    private String text;
    
    public YamlSapElementDefinition() {
    }
    
    // ==================== Getters and Setters ====================
    
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getText() {
        return text;
    }

    public void setText(String text) {
        this.text = text;
    }
    
    // ==================== Conversion Methods ====================
    
    /**
     * Create from SapORObject (reading OR).
     */
    public static YamlSapElementDefinition fromSapORObject(SapORObject object) {
        YamlSapElementDefinition def = new YamlSapElementDefinition();
        
        // Extract properties from attributes
        for (ORAttribute attr : object.getAttributes()) {
            String name = attr.getName();
            String value = attr.getValue();
            
            if (value != null && !value.isEmpty()) {
                switch (name) {
                    case "id":
                        def.setId(value);
                        break;
                    case "Text":
                        def.setText(value);
                        break;
                }
            }
        }
        
        return def;
    }
    
    /**
     * Convert to SapORObject (writing OR).
     */
    public SapORObject toSapORObject(String objectName, ObjectGroup<SapORObject> group) {
        SapORObject object = new SapORObject(objectName, group);
        
        // Set properties as attributes
        for (ORAttribute attr : object.getAttributes()) {
            String name = attr.getName();
            
            switch (name) {
                case "id":
                    if (id != null && !id.isEmpty()) {
                        attr.setValue(id);
                    }
                    break;
                case "Text":
                    if (text != null && !text.isEmpty()) {
                        attr.setValue(text);
                    }
                    break;
            }
        }
        
        return object;
    }
    
    /**
     * Check if this element has any properties defined.
     */
    public boolean isEmpty() {
        return (id == null || id.isEmpty()) && (text == null || text.isEmpty());
    }
    
    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        YamlSapElementDefinition that = (YamlSapElementDefinition) o;
        return Objects.equals(id, that.id) && Objects.equals(text, that.text);
    }
    
    @Override
    public int hashCode() {
        return Objects.hash(id, text);
    }
}
