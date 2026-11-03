package com.cybershield360.protect

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.widget.CheckBox
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView

/** Lets the user pick which apps' notifications are checked. Nothing is selected by
 *  default, and the list itself never leaves the phone; only the picks are reported. */
class AppPickerActivity : Activity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val store = Store(this)
        val pad = (16 * resources.displayMetrics.density).toInt()
        val list = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; setPadding(pad, pad, pad, pad) }
        list.addView(TextView(this).apply {
            text = "Choose messaging, email and banking apps where scam messages could arrive. Avoid apps whose notifications you don't want analysed."
        })
        val launcher = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        val apps = packageManager.queryIntentActivities(launcher, 0)
            .map { it.activityInfo.packageName to it.loadLabel(packageManager).toString() }
            .filter { it.first != packageName }
            .distinctBy { it.first }
            .sortedBy { it.second.lowercase() }
        val selected = store.selectedApps.toMutableSet()
        for ((pkg, label) in apps) {
            list.addView(CheckBox(this).apply {
                text = "$label\n$pkg"
                isChecked = pkg in selected
                setOnCheckedChangeListener { _, on ->
                    if (on) selected.add(pkg) else selected.remove(pkg)
                    store.selectedApps = selected.toSet()
                    store.appsChangedLocally = true
                    SendJobService.scheduleStatus(this@AppPickerActivity)
                }
            })
        }
        setContentView(ScrollView(this).apply { addView(list) })
    }
}
