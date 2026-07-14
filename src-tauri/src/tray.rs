use tauri::menu::{CheckMenuItem, IsMenuItem, Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, Wry};

/// One row in the tray's Active Services section. `running` drives the checkmark.
#[derive(serde::Deserialize)]
pub struct TrayService {
    name: String,
    running: bool,
}

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.set_focus();
    }
}

/// Header + one (disabled, read-only) check row per service + Open Dashboard / Quit.
/// Check items are disabled on purpose: the tick is a status indicator, not a toggle.
fn build_menu(app: &AppHandle, services: &[TrayService]) -> tauri::Result<Menu<Wry>> {
    let header = MenuItem::with_id(app, "hdr", "Active Services", false, None::<&str>)?;
    let empty = MenuItem::with_id(app, "empty", "No active services", false, None::<&str>)?;
    let sep_top = PredefinedMenuItem::separator(app)?;
    let sep_bottom = PredefinedMenuItem::separator(app)?;
    let open = MenuItem::with_id(app, "open", "Open Dashboard", true, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit Nexus Console", true, None::<&str>)?;

    let rows = services
        .iter()
        .map(|s| {
            CheckMenuItem::with_id(
                app,
                format!("svc:{}", s.name),
                &s.name,
                false,
                s.running,
                None::<&str>,
            )
        })
        .collect::<tauri::Result<Vec<CheckMenuItem<Wry>>>>()?;

    let mut items: Vec<&dyn IsMenuItem<Wry>> = vec![&header];
    if rows.is_empty() {
        items.push(&empty);
    } else {
        items.extend(rows.iter().map(|r| r as &dyn IsMenuItem<Wry>));
    }
    items.push(&sep_top);
    items.push(&open);
    items.push(&sep_bottom);
    items.push(&quit);
    Menu::with_items(app, &items)
}

pub fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let menu = build_menu(app, &[])?;
    let mut builder = TrayIconBuilder::with_id("main")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main(app),
            "quit" => app.exit(0),
            _ => {} // service rows are disabled → no events
        });
    // Monochrome template glyph — macOS auto-tints it white/black for the menu bar
    // (like every native menu-bar app), instead of the colorful app icon.
    if let Ok(icon) = tauri::image::Image::from_bytes(include_bytes!("../icons/tray.png")) {
        builder = builder.icon(icon).icon_as_template(true);
    }
    builder.build(app)?;
    Ok(())
}

/// Rebuild the tray menu with the current service list (checkmark = running).
/// Frontend pushes this on every reconcile so the menu mirrors the dashboard.
#[tauri::command]
pub fn set_tray_services(services: Vec<TrayService>, app: AppHandle) {
    if let Some(tray) = app.tray_by_id("main") {
        if let Ok(menu) = build_menu(&app, &services) {
            let _ = tray.set_menu(Some(menu));
        }
    }
}

/// Push the running-count label into the menu-bar (e.g. "2/4"). Empty clears it.
#[tauri::command]
pub fn set_tray_title(title: String, app: AppHandle) {
    if let Some(tray) = app.tray_by_id("main") {
        let _ = tray.set_title(if title.is_empty() { None } else { Some(title) });
    }
}
