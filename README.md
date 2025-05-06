# sn-portfolio

A curated collection of ServiceNow server-side scripts (primarily Script Includes) accumulated across 15 years of enterprise development. This repo captures a sliver of my technical range and the evolution of my scripting patterns over time.

## 📦 Repository Structure

Each top-level folder represents a standalone utility, module, or concept extracted from real-world ServiceNow work:

```

sn-portfolio/
├── ConfigurationBackup/             # Tools for backing up instance configuration
├── DBUtils/                         # Database utility functions (query wrappers, field resolvers, etc.)
├── Mock/                            # Mocking utilities for testing within background scripts
├── Notification Translation Engine/ # Multi-language notification framework
├── SNLog/                           # Custom logging utility with context, levels, and stack trace support
├── SubProd Email Filter/           # Filter logic for controlling sub-production outbound email

```

## 🧠 Purpose

This repo is not just a code dump—it's a window into how I approach scalable ServiceNow development. Each folder contains reusable logic or architectural experiments from different eras of my career.

Use this repo to:

- Browse examples of **real-world logic abstraction** in Script Includes.
- See how **integration concerns, testing, logging, and translations** are handled in scoped apps.
- Gain inspiration for building reusable **utilities** or **system safeguards**.

## 📌 Highlights

- **SNLog**: A structured logger for scoped apps with context injection and error-level filtering.
- **Notification Translation Engine**: A modular approach to internationalizing outbound notifications.
- **DBUtils**: Helpers to abstract GlideRecord calls and resolve dynamic table/field logic.
- **SubProd Email Filter**: Prevents accidental outbound email from dev/test environments.

## 🚧 Usage Notes

These scripts are shared for **reference and inspiration**. Most are tied to scoped app patterns or assume certain instance configurations. Expect to adjust them before use in production.

## 📜 License

All Rights Reserved. Provided for educational/professional reference only.  
Not licensed for commercial use or redistribution.

---

Garrett Griffin-Morales  
[Finite Partners](https://finitepartners.com)