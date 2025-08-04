# Final SQL Cleanup Script
# This removes all the remaining unused SQL files from development

Write-Host "Starting final cleanup of unused SQL scripts..." -ForegroundColor Green

# Files that ARE being used (keep these)
$filesToKeep = @(
    "simple_care_exchange.sql"  # Used in schedule page
)

# All other SQL files can be removed (they are development/testing scripts)
$filesToRemove = @(
    # Migration and System Files
    "simplify_scheduling_system.sql",
    "migration_to_simplified_scheduling_fixed.sql",
    "test_simplified_scheduling.sql",
    "migration_to_simplified_scheduling.sql",
    "simplified_scheduling_final.sql",
    "simplified_scheduling_with_reciprocal.sql",
    "simplified_scheduling_with_editing.sql",
    "simplified_scheduling_schema.sql",
    "comprehensive_scheduling_cleanup.sql",
    "fix_scheduling_system_safe.sql",
    "test_scheduling_system.sql",
    "fix_scheduling_system_comprehensive.sql",
    "clear_scheduling_data.sql",
    "fix_initial_care_exchange.sql",
    "clear_scheduling_data_fresh_start.sql",
    "clear_scheduling_data_updated.sql",
    "test_corrected_invitation_logic.sql",
    "fix_group_invitation_logic.sql",
    "test_calendar_update.sql",
    "clear_and_test_invitation_fix.sql",
    "fix_group_invitation_function.sql",
    "complete_fresh_start.sql",
    "test_child_data_loading.sql",
    "test_child_name_resolution.sql",
    "test_simplified_system.sql",
    "complete_scheduling_reset.sql",
    "fix_duplicate_children_display.sql",
    "fix_all_missing_functions.sql",
    "fix_children_function_errors.sql",
    "test_initial_care_exchange.sql",
    "fix_scheduled_blocks_issues.sql",
    "test_simplified_ui.sql",
    "test_scheduled_blocks_fixes.sql",
    "test_ui_fix_verification.sql",
    "test_dynamic_child_names.sql",
    "test_ui_improvements.sql",
    "test_invitation_modal_fixes.sql",
    "test_two_step_acceptance.sql",
    "fix_invitation_modal_issues.sql",
    "clear_scheduling_data_safe.sql",
    "test_frontend_integration.sql",
    "simplified_scheduling_system_fixed.sql",
    "simplified_scheduling_system.sql",
    "simplified_scheduling_usage_examples.sql",
    "fix_time_blocks_function_working.sql",
    "fix_time_blocks_function_no_assumptions.sql",
    "fix_time_blocks_function_any_columns.sql",
    "fix_time_blocks_function_simple.sql",
    "check_invitation_time_blocks.sql",
    "fix_time_blocks_function.sql",
    "fix_children_functions_final.sql",
    "check_children_columns_simple.sql",
    "check_children_columns.sql",
    "fix_children_functions_any_columns.sql",
    "fix_children_functions_simple.sql",
    "debug_children_table.sql",
    "fix_invitation_time_blocks_final.sql",
    "debug_invitation_data.sql",
    "fix_children_functions_comprehensive.sql",
    "fix_children_functions.sql",
    "check_children_table_structure.sql",
    "create_missing_children_function.sql",
    "create_missing_invitation_functions.sql",
    "fix_group_invitations_constraint_safe.sql",
    "fix_group_invitations_constraint.sql",
    "fix_invitation_functions_final.sql",
    "fix_invitation_function.sql",
    "check_group_members_structure.sql",
    "fix_invitation_rls.sql",
    "create_invitation_functions.sql",
    "check_all_rls_policies.sql",
    "fix_rls_policy.sql",
    "update_sql_function_final.sql",
    "test_sql_function.sql",
    "debug_reciprocal_data.sql",
    "fix_select_response_function.sql",
    "update_select_response_function_with_reciprocal.sql",
    "restore_reciprocal_fields.sql",
    "update_select_response_function.sql",
    "select_response_and_reject_others.sql",
    "clear_schedule_data_fresh.sql",
    "enhance_multi_child_care.sql",
    
    # Additional files that appear to be unused
    "add_message_status_column.sql",
    "add_care_group_id_column.sql", 
    "add_missing_invitation_function.sql",
    "add_reciprocal_fields_fixed.sql",
    "add_reciprocal_fields_safe.sql",
    "add_reciprocal_fields.sql",
    "check_all_rls_policies.sql",
    "check_child_group_members_schema.sql",
    "check_children_columns_simple.sql",
    "check_children_columns.sql",
    "check_children_table_structure.sql",
    "check_current_schema.sql",
    "check_group_members_structure.sql",
    "check_invitation_time_blocks.sql",
    "clear_and_test_invitation_fix.sql",
    "clear_schedule_data_fresh.sql",
    "clear_scheduling_data_fresh_start.sql",
    "clear_scheduling_data_only.sql",
    "clear_scheduling_data_safe.sql",
    "clear_scheduling_data_updated.sql",
    "clear_scheduling_data.sql",
    "clear_scheduling_tables.sql",
    "clear_sitter_records.sql"
)

Write-Host "Files that will be REMOVED:" -ForegroundColor Red
foreach ($file in $filesToRemove) {
    Write-Host "  - $file" -ForegroundColor Yellow
}

Write-Host "`nFiles that will be KEPT:" -ForegroundColor Green
foreach ($file in $filesToKeep) {
    Write-Host "  - $file" -ForegroundColor Cyan
}

# Ask for confirmation
Write-Host "`nThis will remove $($filesToRemove.Count) SQL files." -ForegroundColor Magenta
$confirmation = Read-Host "Do you want to proceed? (y/N)"

if ($confirmation -eq "y" -or $confirmation -eq "Y") {
    $removedCount = 0
    $errorCount = 0
    
    foreach ($file in $filesToRemove) {
        if (Test-Path $file) {
            try {
                Remove-Item $file -Force
                Write-Host "✓ Removed: $file" -ForegroundColor Green
                $removedCount++
            }
            catch {
                Write-Host "✗ Error removing: $file - $($_.Exception.Message)" -ForegroundColor Red
                $errorCount++
            }
        }
        else {
            Write-Host "⚠ File not found: $file" -ForegroundColor Yellow
        }
    }
    
    Write-Host "`nCleanup completed!" -ForegroundColor Green
    Write-Host "Successfully removed: $removedCount files" -ForegroundColor Green
    if ($errorCount -gt 0) {
        Write-Host "Errors encountered: $errorCount files" -ForegroundColor Red
    }
}
else {
    Write-Host "Cleanup cancelled." -ForegroundColor Yellow
} 