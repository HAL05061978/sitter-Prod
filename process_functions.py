#!/usr/bin/env python3
"""
Process AllFunctions.csv to extract all function definitions
and create a SQL script to recreate them in the new database.
"""

import csv
import re

def process_functions_csv():
    """Process the AllFunctions.csv file and create SQL script."""
    
    functions = []
    
    try:
        with open('AllFunctions.csv', 'r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            
            for row in reader:
                routine_name = row['routine_name']
                routine_definition = row['routine_definition']
                data_type = row['data_type']
                specific_name = row['specific_name']
                
                # Clean up the function definition
                if routine_definition and routine_definition.strip():
                    # Remove any extra quotes or formatting
                    definition = routine_definition.strip()
                    if definition.startswith('"') and definition.endswith('"'):
                        definition = definition[1:-1]
                    
                    # Escape any single quotes in the definition
                    definition = definition.replace("'", "''")
                    
                    functions.append({
                        'name': routine_name,
                        'definition': definition,
                        'return_type': data_type,
                        'specific_name': specific_name
                    })
    
    except FileNotFoundError:
        print("AllFunctions.csv not found. Please ensure the file is in the current directory.")
        return
    except Exception as e:
        print(f"Error processing CSV: {e}")
        return
    
    # Create the SQL script
    create_sql_script(functions)

def create_sql_script(functions):
    """Create SQL script with all function definitions."""
    
    sql_content = """-- =============================================
-- ALL FUNCTIONS FROM WORKING DATABASE
-- Generated from AllFunctions.csv
-- =============================================

"""
    
    # Add each function
    for func in functions:
        sql_content += f"""-- Function: {func['name']}
CREATE OR REPLACE FUNCTION {func['name']}()
RETURNS {func['return_type']}
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
{func['definition']}
$$;

"""
    
    # Add grant permissions
    sql_content += """
-- =============================================
-- GRANT EXECUTE PERMISSIONS
-- =============================================

"""
    
    for func in functions:
        sql_content += f"GRANT EXECUTE ON FUNCTION {func['name']}() TO authenticated;\n"
        sql_content += f"GRANT EXECUTE ON FUNCTION {func['name']}() TO anon;\n"
        sql_content += f"GRANT EXECUTE ON FUNCTION {func['name']}() TO service_role;\n\n"
    
    # Add verification
    sql_content += """-- =============================================
-- VERIFICATION
-- =============================================

SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_type = 'FUNCTION'
ORDER BY routine_name;
"""
    
    # Write to file
    with open('step4-all-functions-complete.sql', 'w', encoding='utf-8') as file:
        file.write(sql_content)
    
    print(f"Created step4-all-functions-complete.sql with {len(functions)} functions")

if __name__ == "__main__":
    process_functions_csv()


