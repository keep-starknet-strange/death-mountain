# Changelog

All notable changes to the Loot Survivor Native Shell will be documented in this file.

## [Unreleased]

### Added
- Initial Expo React Native app scaffolding
- WebView component with bridge communication
- Secure JSON-RPC-like bridge protocol
- Bridge methods: echo, controller.*, starknet.*
- Cartridge Controller integration scaffolding
- Security layer with origin and method validation
- Web client adapter for native shell detection
- Comprehensive documentation (README, BRIDGE_SPEC, CARTRIDGE_INTEGRATION, QUICKSTART)
- EAS Build configuration
- TypeScript support throughout
- Expo SecureStore for credential storage

### Security
- Origin allowlist for bridge communication
- Method allowlist for bridge calls
- Request timestamp validation (5-minute window)
- Request structure validation
- 30-second timeout for bridge requests

### Developer Experience
- Hot reload support
- TypeScript types for all bridge methods
- Detailed error codes and messages
- Comprehensive logging
- Example configurations

### Documentation
- Complete README with setup instructions
- Bridge specification with all method details
- Cartridge integration guide
- Quick start guide for developers
- EAS build configuration examples

### Known Limitations
- Cartridge native SDK integration is scaffolded but not implemented
- Native login requires actual Cartridge SDK implementation
- Profile opening is stubbed
- No payment integration (out of scope)

## Future Roadmap

### v0.2.0 (Planned)
- [ ] Complete Cartridge native SDK integration
- [ ] Implement passkey authentication
- [ ] Add session key management
- [ ] Native UI for authentication
- [ ] Transaction policy configuration
- [ ] Biometric authentication support

### v0.3.0 (Planned)
- [ ] Deep linking support
- [ ] Push notifications
- [ ] Offline mode support
- [ ] Analytics integration
- [ ] Performance optimizations

### v1.0.0 (Planned)
- [ ] Production-ready Cartridge integration
- [ ] App Store / Play Store submission
- [ ] Full test coverage
- [ ] Performance benchmarks
- [ ] Security audit

## Notes

This is the initial release focused on establishing the architecture and bridge communication. The Cartridge Controller integration requires additional work with Cartridge's native SDK.

For detailed information about each feature, see the respective documentation files.
