// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// Use lib.rs entry point
use cocktail_app_lib::run;

fn main() {
    run();
}
