# Store access tokens in macOS Keychain

The macOS installation uses a read-only personal access token for the private GitLab instance and a fine-grained GitHub token restricted to read/write access on the Mirror Repository. Both secrets live in macOS Keychain rather than the editable configuration file, avoiding browser-cookie coupling, plaintext credentials, and reliance on an interactive SSH Agent during scheduled runs.
