import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';

void main() => runApp(const FieldApp());

class FieldApp extends StatelessWidget {
  const FieldApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'LM Field Verification',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF0B559F),
          primary: const Color(0xFF0B559F),
          secondary: const Color(0xFF1E88E5),
        ),
        useMaterial3: true,
        inputDecorationTheme: const InputDecorationTheme(
          border: OutlineInputBorder(),
          contentPadding: EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        ),
      ),
      home: const SplashScreen(),
    );
  }
}

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _checkAuth();
  }

  Future<void> _checkAuth() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('jwt_token');
    if (token != null && token.isNotEmpty) {
      if (mounted) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (context) => const TasksPage()),
        );
        return;
      }
    }
    if (mounted) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (context) => const LoginPage()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.verified_user_rounded, size: 72, color: Color(0xFF0B559F)),
            SizedBox(height: 16),
            Text('Legal Metrology Field Portal', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            SizedBox(height: 24),
            CircularProgressIndicator(),
          ],
        ),
      ),
    );
  }
}

class LoginPage extends StatefulWidget {
  const LoginPage({super.key});

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _emailController = TextEditingController(text: 'lmo.chennai@test.com');
  final _passwordController = TextEditingController(text: 'Password123');
  final _urlController = TextEditingController(text: kIsWeb ? 'http://127.0.0.1:8000' : 'http://10.0.2.2:8000');
  bool _busy = false;
  String _error = '';

  Future<void> _login() async {
    setState(() {
      _busy = true;
      _error = '';
    });
    try {
      final baseUrl = _urlController.text.trim();
      final response = await http.post(
        Uri.parse('$baseUrl/auth/login'),
        body: {
          'username': _emailController.text.trim(),
          'password': _passwordController.text,
        },
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final token = data['access_token'];
        final prefs = await SharedPreferences.getInstance();
        await prefs.setString('jwt_token', token);
        await prefs.setString('api_url', baseUrl);

        // Fetch officer profile
        try {
          final meRes = await http.get(
            Uri.parse('$baseUrl/auth/me'),
            headers: {'Authorization': 'Bearer $token'},
          );
          if (meRes.statusCode == 200) {
            final user = jsonDecode(meRes.body);
            await prefs.setString('user_name', user['full_name'] ?? '');
            await prefs.setString('user_role', user['role'] ?? '');
            await prefs.setString('user_district', user['district'] ?? '');
          }
        } catch (_) {}

        if (mounted) {
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (context) => const TasksPage()),
          );
        }
      } else {
        final body = jsonDecode(response.body);
        setState(() => _error = body['detail'] ?? 'Invalid credentials');
      }
    } catch (e) {
      setState(() => _error = 'Cannot connect to backend server: $e');
    } finally {
      setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('LM Digital Verification')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Icon(Icons.shield_outlined, size: 64, color: Color(0xFF0B559F)),
            const SizedBox(height: 16),
            const Text(
              'Field Officer Portal',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
            ),
            const Text(
              'GATC Amendment 2025 Verification Client',
              textAlign: TextAlign.center,
              style: TextStyle(color: Colors.grey),
            ),
            const SizedBox(height: 32),
            TextField(
              controller: _urlController,
              decoration: const InputDecoration(labelText: 'Backend Server URL', hintText: 'http://10.0.2.2:8000 or http://127.0.0.1:8000'),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _emailController,
              decoration: const InputDecoration(labelText: 'Officer Email Address'),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _passwordController,
              obscureText: true,
              decoration: const InputDecoration(labelText: 'Password'),
            ),
            if (_error.isNotEmpty) ...[
              const SizedBox(height: 16),
              Text(_error, style: const TextStyle(color: Colors.red, fontWeight: FontWeight.bold)),
            ],
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _busy ? null : _login,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0B559F),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
              ),
              child: _busy ? const CircularProgressIndicator(color: Colors.white) : const Text('Sign In Securely', style: TextStyle(fontSize: 16)),
            ),
            const SizedBox(height: 16),
            OutlinedButton.icon(
              onPressed: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => QRScanPage(
                      initialBaseUrl: _urlController.text.trim(),
                    ),
                  ),
                );
              },
              icon: const Icon(Icons.qr_code_scanner, color: Color(0xFF0B559F)),
              label: const Text('Scan QR / Verify Instrument Certificate', style: TextStyle(fontWeight: FontWeight.bold)),
              style: OutlinedButton.styleFrom(
                padding: const EdgeInsets.symmetric(vertical: 14),
                side: const BorderSide(color: Color(0xFF0B559F), width: 1.5),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class TasksPage extends StatefulWidget {
  const TasksPage({super.key});

  @override
  State<TasksPage> createState() => _TasksPageState();
}

class _TasksPageState extends State<TasksPage> {
  List<dynamic> _assignments = [];
  List<dynamic> _complaints = [];
  List<dynamic> _appointments = [];
  List<dynamic> _offlineDrafts = [];
  bool _loading = false;
  String _statusMessage = '';
  String _searchQuery = '';
  String _officerName = '';
  String _officerDistrict = '';

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() => _loading = true);
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('jwt_token') ?? '';
    final baseUrl = prefs.getString('api_url') ?? '';
    _officerName = prefs.getString('user_name') ?? 'Officer';
    _officerDistrict = prefs.getString('user_district') ?? '';

    // Load offline drafts
    final draftsStr = prefs.getString('offline_drafts') ?? '[]';
    setState(() {
      _offlineDrafts = jsonDecode(draftsStr);
    });

    if (token.isEmpty || baseUrl.isEmpty) {
      setState(() {
        _loading = false;
        _statusMessage = 'Offline Mode (Local Cache)';
      });
      return;
    }

    try {
      final assignRes = await http.get(
        Uri.parse('$baseUrl/assignments'),
        headers: {'Authorization': 'Bearer $token'},
      ).timeout(const Duration(seconds: 8));

      final compRes = await http.get(
        Uri.parse('$baseUrl/complaints'),
        headers: {'Authorization': 'Bearer $token'},
      ).timeout(const Duration(seconds: 8));

      final apptRes = await http.get(
        Uri.parse('$baseUrl/scheduling/my-appointments'),
        headers: {'Authorization': 'Bearer $token'},
      ).timeout(const Duration(seconds: 8));

      if (assignRes.statusCode == 200) {
        _assignments = jsonDecode(assignRes.body);
      }
      if (compRes.statusCode == 200) {
        _complaints = jsonDecode(compRes.body);
      }
      if (apptRes.statusCode == 200) {
        _appointments = jsonDecode(apptRes.body);
      }

      setState(() {
        _statusMessage = 'Online · Synchronized';
      });
    } catch (e) {
      setState(() => _statusMessage = 'Offline Mode · Using Cached Drafts');
    } finally {
      setState(() => _loading = false);
    }
  }


  Future<void> _syncDrafts() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('jwt_token') ?? '';
    final baseUrl = prefs.getString('api_url') ?? '';

    if (token.isEmpty || baseUrl.isEmpty || _offlineDrafts.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('No offline drafts to synchronize.')),
      );
      return;
    }

    int successCount = 0;
    List<dynamic> remainingDrafts = [];

    for (var draft in _offlineDrafts) {
      try {
        // 1. Create verification record
        final createRes = await http.post(
          Uri.parse('$baseUrl/verifications'),
          headers: {
            'Authorization': 'Bearer $token',
            'Content-Type': 'application/json',
          },
          body: jsonEncode({
            'application_number': draft['application_number'],
            'latitude': draft['latitude'],
            'longitude': draft['longitude'],
            'remarks': draft['remarks'],
            'observations': List<String>.from(draft['observations'] ?? []),
            'measurements': draft['measurements'] ?? [],
            'standards_used': draft['standards_used'],
            'defects_found': draft['defects_found'],
          }),
        );

        if (createRes.statusCode == 201 || createRes.statusCode == 200) {
          final verificationId = jsonDecode(createRes.body)['id'];

          // 2. Upload multiple photo evidences if present
          final photoPaths = List<String>.from(draft['photo_paths'] ?? []);
          for (var p in photoPaths) {
            try {
              final xfile = XFile(p);
              final bytes = await xfile.readAsBytes();
              if (bytes.isNotEmpty) {
                final req = http.MultipartRequest('POST', Uri.parse('$baseUrl/verifications/$verificationId/evidence'));
                req.headers['Authorization'] = 'Bearer $token';
                req.files.add(http.MultipartFile.fromBytes('file', bytes, filename: 'evidence.jpg'));
                if (draft['latitude'] != null) req.fields['latitude'] = draft['latitude'].toString();
                if (draft['longitude'] != null) req.fields['longitude'] = draft['longitude'].toString();
                await req.send();
              }
            } catch (_) {}
          }

          // 3. Finalise and approve verification
          final approveRes = await http.post(
            Uri.parse('$baseUrl/verifications/$verificationId/approve'),
            headers: {'Authorization': 'Bearer $token'},
          );

          if (approveRes.statusCode == 200) {
            successCount++;
          } else {
            remainingDrafts.add(draft);
          }
        } else {
          remainingDrafts.add(draft);
        }
      } catch (e) {
        remainingDrafts.add(draft);
      }
    }

    setState(() {
      _offlineDrafts = remainingDrafts;
    });
    await prefs.setString('offline_drafts', jsonEncode(_offlineDrafts));

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Auto-sync complete: $successCount synchronized, ${remainingDrafts.length} pending.')),
      );
    }
    _fetchData();
  }

  Future<void> _logout() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('jwt_token');
    if (mounted) {
      Navigator.pushReplacement(
        context,
        MaterialPageRoute(builder: (context) => const LoginPage()),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final filtered = _assignments.filterByQuery(_searchQuery);

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(_officerName.isNotEmpty ? _officerName : 'Assigned Inspections', style: const TextStyle(fontSize: 18)),
            if (_officerDistrict.isNotEmpty)
              Text('Jurisdiction: $_officerDistrict', style: const TextStyle(fontSize: 12, color: Colors.black54)),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.qr_code_scanner),
            tooltip: 'Scan QR / Verify Certificate',
            onPressed: () async {
              final prefs = await SharedPreferences.getInstance();
              final baseUrl = prefs.getString('api_url') ?? 'http://127.0.0.1:8000';
              if (mounted) {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => QRScanPage(initialBaseUrl: baseUrl),
                  ),
                );
              }
            },
          ),
          IconButton(icon: const Icon(Icons.cloud_sync), tooltip: 'Sync Drafts', onPressed: _syncDrafts),
          IconButton(icon: const Icon(Icons.refresh), tooltip: 'Refresh', onPressed: _fetchData),
          IconButton(icon: const Icon(Icons.logout), tooltip: 'Logout', onPressed: _logout),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final prefs = await SharedPreferences.getInstance();
          final baseUrl = prefs.getString('api_url') ?? 'http://127.0.0.1:8000';
          if (mounted) {
            Navigator.push(
              context,
              MaterialPageRoute(
                builder: (context) => QRScanPage(initialBaseUrl: baseUrl),
              ),
            );
          }
        },
        icon: const Icon(Icons.qr_code_scanner),
        label: const Text('Scan QR'),
        backgroundColor: const Color(0xFF0B559F),
        foregroundColor: Colors.white,
      ),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _fetchData,
              child: ListView(
                padding: const EdgeInsets.all(16.0),
                children: [
                  // Status Banner
                  Container(
                    padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                    decoration: BoxDecoration(
                      color: _statusMessage.contains('Online') ? Colors.green.shade50 : Colors.orange.shade50,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: _statusMessage.contains('Online') ? Colors.green.shade200 : Colors.orange.shade200),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(_statusMessage.contains('Online') ? Icons.check_circle : Icons.cloud_off, size: 18, color: _statusMessage.contains('Online') ? Colors.green : Colors.orange),
                        const SizedBox(width: 8),
                        Text(_statusMessage, style: const TextStyle(fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Search box
                  TextField(
                    decoration: const InputDecoration(
                      hintText: 'Search applications, instruments, districts…',
                      prefixIcon: Icon(Icons.search),
                    ),
                    onChanged: (String value) {
                      setState(() {
                        _searchQuery = value.trim();
                      });
                    },
                  ),
                  const SizedBox(height: 16),

                  // Offline Drafts Section
                  if (_offlineDrafts.isNotEmpty) ...[
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Offline Drafts (${_offlineDrafts.length})', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.orange)),
                        TextButton.icon(icon: const Icon(Icons.sync), label: const Text('Sync All'), onPressed: _syncDrafts),
                      ],
                    ),
                    ..._offlineDrafts.map((draft) => Card(
                          color: Colors.orange.shade50,
                          margin: const EdgeInsets.only(bottom: 8),
                          child: ListTile(
                            leading: const Icon(Icons.pending_actions, color: Colors.orange),
                            title: Text('App: ${draft['application_number']}'),
                            subtitle: Text('Standards: ${draft['standards_used'] ?? '—'}\nPhotos: ${(draft['photo_paths'] as List?)?.length ?? 0}'),
                            isThreeLine: true,
                            trailing: const Icon(Icons.chevron_right),
                            onTap: () {
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (context) => VerificationDetailPage(
                                    applicationNumber: draft['application_number'] ?? '',
                                    initialDraft: draft,
                                  ),
                                ),
                              ).then((_) => _fetchData());
                            },
                          ),
                        )),
                    const Divider(height: 24),
                  ],

                  // Assigned Inspections List
                  const Text('Jurisdiction Assignments (Auto-Assigned)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 8),

                  if (filtered.isEmpty)
                    const Center(child: Padding(padding: EdgeInsets.all(32), child: Text('No matching assigned inspections found.')))
                  else
                    ...filtered.map((a) {
                      final inst = a['instrument'];
                      return Card(
                        margin: const EdgeInsets.only(bottom: 12),
                        child: ListTile(
                          leading: const CircleAvatar(
                            backgroundColor: Color(0xFF0B559F),
                            child: Icon(Icons.scale, color: Colors.white),
                          ),
                          title: Text(a['application_number'] ?? 'Application #${a['id']}'),
                          subtitle: Text(
                            '${inst != null ? '${inst['manufacturer']} ${inst['model']} (${inst['category']})' : 'Instrument ID: ${a['application_id']}'}\n'
                            'Location: ${a['location'] ?? '—'}\n'
                            'Scheduled: ${a['scheduled_at']}',
                          ),
                          isThreeLine: true,
                          trailing: Chip(
                            label: Text(a['status'] ?? 'ASSIGNED', style: const TextStyle(fontSize: 11)),
                            backgroundColor: a['status'] == 'COMPLETED' ? Colors.green.shade100 : Colors.blue.shade50,
                          ),
                          onTap: () {
                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) => VerificationDetailPage(
                                  applicationNumber: a['application_number'] ?? '',
                                  assignment: a,
                                ),
                              ),
                            ).then((_) => _fetchData());
                          },
                        ),
                      );
                    }),

                  // Confirmed Smart Appointments Section
                  if (_appointments.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Text('Today & Upcoming Appointments (${_appointments.length})', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Color(0xFF0B559F))),
                    const SizedBox(height: 8),
                    ..._appointments.map((appt) => Card(
                          margin: const EdgeInsets.only(bottom: 8),
                          child: ListTile(
                            leading: const Icon(Icons.alarm_on, color: Color(0xFF0B559F)),
                            title: Text('${appt['slot_date']} (${appt['start_time']} - ${appt['end_time']})'),
                            subtitle: Text('App: ${appt['application_number'] ?? 'N/A'}\nLocation: ${appt['location'] ?? 'Field Site'}'),
                            isThreeLine: true,
                            trailing: Chip(
                              label: Text(appt['status'] ?? 'BOOKED', style: const TextStyle(fontSize: 11)),
                              backgroundColor: Colors.blue.shade50,
                            ),
                          ),
                        )),
                  ],

                  // Citizen Complaints Section
                  if (_complaints.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Citizen Complaints (${_complaints.length})', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.red)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    ..._complaints.map((c) => Card(
                          margin: const EdgeInsets.only(bottom: 8),
                          child: ListTile(
                            leading: CircleAvatar(
                              backgroundColor: c['is_repeat_offender'] == true ? Colors.red : Colors.orange,
                              child: const Icon(Icons.warning_amber_rounded, color: Colors.white),
                            ),
                            title: Text(c['complaint_number'] ?? 'Complaint'),
                            subtitle: Text('${c['shop_name']} (${c['district']})\nViolation: ${c['violation_type']}\nRisk: ${c['risk_score']}/100'),
                            isThreeLine: true,
                            trailing: Chip(
                              label: Text(c['status'] ?? 'ASSIGNED', style: const TextStyle(fontSize: 10)),
                              backgroundColor: c['status'] == 'RESOLVED' ? Colors.green.shade100 : Colors.red.shade50,
                            ),
                          ),
                        )),
                  ],
                ],
              ),
            ),

      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => const VerificationDetailPage(
                applicationNumber: '',
                assignment: null,
              ),
            ),
          ).then((_) => _fetchData());
        },
        backgroundColor: const Color(0xFF0B559F),
        foregroundColor: Colors.white,
        label: const Text('New Field Record'),
        icon: const Icon(Icons.add_photo_alternate_rounded),
      ),
    );
  }
}

extension ListFilter on List<dynamic> {
  List<dynamic> filterByQuery(String query) {
    if (query.isEmpty) return this;
    final q = query.toLowerCase();
    return where((item) {
      final jsonStr = jsonEncode(item).toLowerCase();
      return jsonStr.contains(q);
    }).toList();
  }
}

class VerificationDetailPage extends StatefulWidget {
  final String applicationNumber;
  final dynamic assignment;
  final dynamic initialDraft;

  const VerificationDetailPage({
    super.key,
    required this.applicationNumber,
    this.assignment,
    this.initialDraft,
  });

  @override
  State<VerificationDetailPage> createState() => _VerificationDetailPageState();
}

class _VerificationDetailPageState extends State<VerificationDetailPage> {
  final _appController = TextEditingController();
  final _latitudeController = TextEditingController();
  final _longitudeController = TextEditingController();
  final _standardsController = TextEditingController();
  final _defectsController = TextEditingController();
  final _remarksController = TextEditingController();

  final List<String> _observations = [];
  final List<Map<String, dynamic>> _measurements = [];
  final List<String> _photoPaths = [];

  final _obsController = TextEditingController();
  final _measParamController = TextEditingController();
  final _measExpectedController = TextEditingController();
  final _measObservedController = TextEditingController();
  final _measUnitController = TextEditingController(text: 'kg');
  bool _measWithinTolerance = true;

  bool _busy = false;

  @override
  void initState() {
    super.initState();
    _initFromProps();
  }

  void _initFromProps() {
    if (widget.initialDraft != null) {
      final d = widget.initialDraft;
      _appController.text = d['application_number'] ?? '';
      _latitudeController.text = d['latitude']?.toString() ?? '';
      _longitudeController.text = d['longitude']?.toString() ?? '';
      _standardsController.text = d['standards_used'] ?? '';
      _defectsController.text = d['defects_found'] ?? '';
      _remarksController.text = d['remarks'] ?? '';
      _observations.addAll(List<String>.from(d['observations'] ?? []));
      _measurements.addAll(List<Map<String, dynamic>>.from(d['measurements'] ?? []));
      _photoPaths.addAll(List<String>.from(d['photo_paths'] ?? []));
    } else {
      _appController.text = widget.applicationNumber.isNotEmpty
          ? widget.applicationNumber
          : (widget.assignment != null ? (widget.assignment['application_number'] ?? '') : '');
    }
  }

  Future<void> _captureLocation() async {
    try {
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enable location services.')));
        return;
      }
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) return;
      }
      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high),
      );
      setState(() {
        _latitudeController.text = position.latitude.toStringAsFixed(6);
        _longitudeController.text = position.longitude.toStringAsFixed(6);
      });
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('GPS coordinates captured.')));
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('GPS error: $e')));
    }
  }

  Future<void> _pickImage(ImageSource source) async {
    final picker = ImagePicker();
    final pickedFile = await picker.pickImage(source: source, imageQuality: 85);
    if (pickedFile != null) {
      setState(() {
        _photoPaths.add(pickedFile.path);
      });
    }
  }

  Future<void> _saveDraft() async {
    if (_appController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Application Number is required')));
      return;
    }

    final draft = {
      'application_number': _appController.text.trim(),
      'latitude': double.tryParse(_latitudeController.text),
      'longitude': double.tryParse(_longitudeController.text),
      'remarks': _remarksController.text,
      'standards_used': _standardsController.text,
      'defects_found': _defectsController.text,
      'observations': _observations,
      'measurements': _measurements,
      'photo_paths': _photoPaths,
      'saved_at': DateTime.now().toIso8601String(),
    };

    final prefs = await SharedPreferences.getInstance();
    final draftsStr = prefs.getString('offline_drafts') ?? '[]';
    final List<dynamic> drafts = jsonDecode(draftsStr);
    drafts.removeWhere((d) => d['application_number'] == draft['application_number']);
    drafts.add(draft);
    await prefs.setString('offline_drafts', jsonEncode(drafts));

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Verification saved as local draft.')));
      Navigator.pop(context);
    }
  }

  Future<void> _submitOnline() async {
    if (_appController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Application Number is required')));
      return;
    }

    setState(() => _busy = true);
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('jwt_token') ?? '';
    final baseUrl = prefs.getString('api_url') ?? '';

    if (token.isEmpty || baseUrl.isEmpty) {
      setState(() => _busy = false);
      _saveDraft();
      return;
    }

    try {
      // 1. Submit Verification Record
      final response = await http.post(
        Uri.parse('$baseUrl/verifications'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: jsonEncode({
          'application_number': _appController.text.trim(),
          'latitude': double.tryParse(_latitudeController.text),
          'longitude': double.tryParse(_longitudeController.text),
          'remarks': _remarksController.text,
          'observations': _observations,
          'measurements': _measurements,
          'standards_used': _standardsController.text,
          'defects_found': _defectsController.text,
        }),
      );

      if (response.statusCode == 201 || response.statusCode == 200) {
        final verificationId = jsonDecode(response.body)['id'];

        // 2. Upload multiple photo evidences
        for (var p in _photoPaths) {
          try {
            final xfile = XFile(p);
            final bytes = await xfile.readAsBytes();
            if (bytes.isNotEmpty) {
              final req = http.MultipartRequest('POST', Uri.parse('$baseUrl/verifications/$verificationId/evidence'));
              req.headers['Authorization'] = 'Bearer $token';
              req.files.add(http.MultipartFile.fromBytes('file', bytes, filename: 'evidence.jpg'));
              if (_latitudeController.text.isNotEmpty) req.fields['latitude'] = _latitudeController.text;
              if (_longitudeController.text.isNotEmpty) req.fields['longitude'] = _longitudeController.text;
              await req.send();
            }
          } catch (_) {}
        }

        // 3. Finalise and approve verification
        final approveRes = await http.post(
          Uri.parse('$baseUrl/verifications/$verificationId/approve'),
          headers: {'Authorization': 'Bearer $token'},
        );

        if (approveRes.statusCode == 200 && mounted) {
          final certData = jsonDecode(approveRes.body);
          // Remove from offline drafts if it was a draft
          final draftsStr = prefs.getString('offline_drafts') ?? '[]';
          final List<dynamic> drafts = jsonDecode(draftsStr);
          drafts.removeWhere((d) => d['application_number'] == _appController.text.trim());
          await prefs.setString('offline_drafts', jsonEncode(drafts));

          showDialog(
            context: context,
            builder: (ctx) => AlertDialog(
              title: const Text('✓ Verification Approved'),
              content: Text(
                'Digital certificate generated successfully!\n\n'
                'Certificate No: ${certData['certificate_number']}\n'
                'SHA-256 Digest: ${certData['certificate_hash']?.substring(0, 16)}…\n'
                'QR Token: ${certData['qr_token']?.substring(0, 12)}…',
              ),
              actions: [
                TextButton(
                  onPressed: () {
                    Navigator.pop(ctx);
                    Navigator.pop(context);
                  },
                  child: const Text('Done'),
                ),
              ],
            ),
          );
        } else {
          throw Exception('Approval failed: ${approveRes.body}');
        }
      } else {
        throw Exception(response.body);
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Online submission failed: $e. Saved to draft.')));
      _saveDraft();
    } finally {
      setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Field Verification Workbench')),
      body: _busy
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              padding: const EdgeInsets.all(20.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  TextField(
                    controller: _appController,
                    decoration: const InputDecoration(labelText: 'Application Number', hintText: 'LM-APP-TN-2026-000001'),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _latitudeController,
                          decoration: const InputDecoration(labelText: 'Latitude'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: TextField(
                          controller: _longitudeController,
                          decoration: const InputDecoration(labelText: 'Longitude'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  ElevatedButton.icon(
                    onPressed: _captureLocation,
                    icon: const Icon(Icons.gps_fixed),
                    label: const Text('Capture On-Site GPS Location'),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _standardsController,
                    decoration: const InputDecoration(labelText: 'Working Standards Used / Reference Equipment', hintText: 'e.g. Class M1 Test Weights Set (150kg)'),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _defectsController,
                    decoration: const InputDecoration(labelText: 'Defects / Non-Conformities Found', hintText: 'e.g. None / zero deviation noted'),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _remarksController,
                    decoration: const InputDecoration(labelText: 'General Inspection Remarks'),
                  ),
                  const SizedBox(height: 24),

                  // Observations Section
                  const Text('Observations Checklist', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(controller: _obsController, decoration: const InputDecoration(hintText: 'Enter observation')),
                      ),
                      IconButton(
                        icon: const Icon(Icons.add_circle, color: Color(0xFF0B559F)),
                        onPressed: () {
                          if (_obsController.text.trim().isNotEmpty) {
                            setState(() {
                              _observations.add(_obsController.text.trim());
                              _obsController.clear();
                            });
                          }
                        },
                      ),
                    ],
                  ),
                  ..._observations.map((o) => ListTile(
                        title: Text(o),
                        trailing: IconButton(
                          icon: const Icon(Icons.delete, color: Colors.red),
                          onPressed: () => setState(() => _observations.remove(o)),
                        ),
                      )),
                  const Divider(height: 32),

                  // Measurements Section
                  const Text('Verification Measurements', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 8),
                  TextField(controller: _measParamController, decoration: const InputDecoration(hintText: 'Parameter (e.g. Quarter Capacity Load)')),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(child: TextField(controller: _measExpectedController, decoration: const InputDecoration(hintText: 'Expected'))),
                      const SizedBox(width: 8),
                      Expanded(child: TextField(controller: _measObservedController, decoration: const InputDecoration(hintText: 'Observed'))),
                      const SizedBox(width: 8),
                      Expanded(child: TextField(controller: _measUnitController, decoration: const InputDecoration(hintText: 'Unit'))),
                    ],
                  ),
                  Row(
                    children: [
                      Checkbox(
                        value: _measWithinTolerance,
                        onChanged: (val) => setState(() => _measWithinTolerance = val ?? true),
                      ),
                      const Text('Within Tolerance'),
                      const Spacer(),
                      ElevatedButton(
                        onPressed: () {
                          if (_measParamController.text.isNotEmpty && _measObservedController.text.isNotEmpty) {
                            setState(() {
                              _measurements.add({
                                'parameter': _measParamController.text,
                                'expected_value': double.tryParse(_measExpectedController.text),
                                'observed_value': double.parse(_measObservedController.text),
                                'unit': _measUnitController.text,
                                'within_tolerance': _measWithinTolerance,
                              });
                              _measParamController.clear();
                              _measExpectedController.clear();
                              _measObservedController.clear();
                            });
                          }
                        },
                        child: const Text('+ Add Measurement'),
                      ),
                    ],
                  ),
                  ..._measurements.map((m) => ListTile(
                        title: Text('${m['parameter']}: ${m['observed_value']} ${m['unit']}'),
                        subtitle: Text('Expected: ${m['expected_value'] ?? '—'} · Result: ${m['within_tolerance'] ? 'PASS' : 'FAIL'}'),
                        trailing: IconButton(
                          icon: const Icon(Icons.delete, color: Colors.red),
                          onPressed: () => setState(() => _measurements.remove(m)),
                        ),
                      )),
                  const Divider(height: 32),

                  // Multiple Evidence Photos
                  const Text('Field Evidence Photographs (Multiple)', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      ElevatedButton.icon(
                        onPressed: () => _pickImage(ImageSource.camera),
                        icon: const Icon(Icons.camera_alt),
                        label: const Text('Camera'),
                      ),
                      const SizedBox(width: 12),
                      OutlinedButton.icon(
                        onPressed: () => _pickImage(ImageSource.gallery),
                        icon: const Icon(Icons.photo_library),
                        label: const Text('Gallery'),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (_photoPaths.isEmpty)
                    const Text('No photos captured yet.', style: TextStyle(color: Colors.grey))
                  else
                    SizedBox(
                      height: 100,
                      child: ListView.builder(
                        scrollDirection: Axis.horizontal,
                        itemCount: _photoPaths.length,
                        itemBuilder: (context, index) {
                          final path = _photoPaths[index];
                          return Stack(
                            children: [
                              Container(
                                margin: const EdgeInsets.only(right: 10),
                                width: 100,
                                height: 100,
                                decoration: BoxDecoration(
                                  borderRadius: BorderRadius.circular(8),
                                  color: Colors.grey.shade200,
                                ),
                                clipBehavior: Clip.antiAlias,
                                child: Image.network(
                                  path,
                                  width: 100,
                                  height: 100,
                                  fit: BoxFit.cover,
                                  errorBuilder: (_, __, ___) => const Center(
                                    child: Icon(Icons.photo, color: Colors.grey, size: 36),
                                  ),
                                ),
                              ),
                              Positioned(
                                top: 0,
                                right: 10,
                                child: GestureDetector(
                                  onTap: () => setState(() => _photoPaths.removeAt(index)),
                                  child: const CircleAvatar(
                                    radius: 12,
                                    backgroundColor: Colors.red,
                                    child: Icon(Icons.close, size: 14, color: Colors.white),
                                  ),
                                ),
                              ),
                            ],
                          );
                        },
                      ),
                    ),
                  const SizedBox(height: 32),

                  // Action Buttons
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: _saveDraft,
                          style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14)),
                          child: const Text('Save Offline Draft'),
                        ),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: ElevatedButton(
                          onPressed: _submitOnline,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF0B559F),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 14),
                          ),
                          child: const Text('Approve & Generate Cert'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
    );
  }
}

extension ListFilter on List<dynamic> {
  List<dynamic> filterByQuery(String query) {
    if (query.isEmpty) return this;
    final q = query.toLowerCase();
    return where((item) {
      final appNum = (item['application_number'] ?? '').toString().toLowerCase();
      final inst = item['instrument'] as Map<String, dynamic>?;
      final instType = (inst?['instrument_type'] ?? '').toString().toLowerCase();
      final owner = (inst?['owner_name'] ?? '').toString().toLowerCase();
      final dist = (inst?['district'] ?? '').toString().toLowerCase();
      return appNum.contains(q) || instType.contains(q) || owner.contains(q) || dist.contains(q);
    }).toList();
  }
}

// ==============================================================================
// 1. DEDICATED QR SCANNER & TOKEN RESOLUTION PAGE
// ==============================================================================
class QRScanPage extends StatefulWidget {
  final String initialBaseUrl;
  const QRScanPage({super.key, required this.initialBaseUrl});

  @override
  State<QRScanPage> createState() => _QRScanPageState();
}

class _QRScanPageState extends State<QRScanPage> {
  late TextEditingController _urlController;
  final TextEditingController _tokenController = TextEditingController();
  bool _busy = false;
  String _errorMessage = '';

  @override
  void initState() {
    super.initState();
    _urlController = TextEditingController(text: widget.initialBaseUrl.isNotEmpty ? widget.initialBaseUrl : 'http://127.0.0.1:8000');
  }

  @override
  void dispose() {
    _urlController.dispose();
    _tokenController.dispose();
    super.dispose();
  }

  Future<void> _verifyToken(String inputToken) async {
    final rawInput = inputToken.trim();
    if (rawInput.isEmpty) {
      setState(() => _errorMessage = 'Please enter or scan a QR code token.');
      return;
    }

    // Extract identifier if full URL was scanned
    String identifier = rawInput;
    if (identifier.contains('/verify/')) {
      identifier = identifier.split('/verify/').last;
    }
    identifier = Uri.decodeComponent(identifier);

    setState(() {
      _busy = true;
      _errorMessage = '';
    });

    final baseUrl = _urlController.text.trim().replaceAll(RegExp(r'/+$'), '');

    try {
      final response = await http.get(
        Uri.parse('$baseUrl/public/verify/${Uri.encodeComponent(identifier)}'),
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final certData = jsonDecode(response.body);
        if (mounted) {
          Navigator.push(
            context,
            MaterialPageRoute(
              builder: (context) => PublicCertificateVerificationPage(
                certificate: certData,
                baseUrl: baseUrl,
              ),
            ),
          );
        }
      } else {
        final err = jsonDecode(response.body);
        setState(() {
          _errorMessage = err['detail'] ?? 'Certificate not found or invalid QR token.';
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = 'Network connection failed: $e\nEnsure backend server is running on $baseUrl';
      });
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Scan QR Code'),
        backgroundColor: const Color(0xFF0B559F),
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Scanner Viewfinder Card
            Container(
              padding: const EdgeInsets.all(28.0),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF0F172A), Color(0xFF1E293B)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(16),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.2),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Container(
                    width: 140,
                    height: 140,
                    decoration: BoxDecoration(
                      border: Border.all(color: const Color(0xFF38BDF8), width: 3),
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: const Center(
                      child: Icon(Icons.qr_code_2_rounded, size: 90, color: Color(0xFF38BDF8)),
                    ),
                  ),
                  const SizedBox(height: 16),
                  const Text(
                    'ScaleSync QR Verification',
                    style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Point camera at instrument tamper-proof seal or digital certificate QR code',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Colors.white70, fontSize: 13),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // Server URL field
            TextField(
              controller: _urlController,
              decoration: const InputDecoration(
                labelText: 'API Gateway Endpoint',
                prefixIcon: Icon(Icons.dns),
              ),
            ),
            const SizedBox(height: 16),

            // Token input field
            TextField(
              controller: _tokenController,
              decoration: InputDecoration(
                labelText: 'Scanned QR Token or Certificate No.',
                hintText: 'e.g. LM-CERT-2025-001 or paste /verify/... URL',
                prefixIcon: const Icon(Icons.verified_outlined),
                suffixIcon: IconButton(
                  icon: const Icon(Icons.arrow_forward_rounded, color: Color(0xFF0B559F)),
                  onPressed: () => _verifyToken(_tokenController.text),
                ),
              ),
              onSubmitted: _verifyToken,
            ),
            const SizedBox(height: 16),

            if (_errorMessage.isNotEmpty)
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.red.shade50,
                  border: Border.all(color: Colors.red.shade200),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.error_outline, color: Colors.red),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(_errorMessage, style: const TextStyle(color: Colors.red, fontWeight: FontWeight.w600)),
                    ),
                  ],
                ),
              ),

            const SizedBox(height: 20),

            ElevatedButton.icon(
              onPressed: _busy ? null : () => _verifyToken(_tokenController.text),
              icon: const Icon(Icons.search),
              label: _busy
                  ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : const Text('Verify Certificate Authenticity', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0B559F),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),

            const SizedBox(height: 28),

            // Quick Demo Barcode Simulation
            const Text(
              'QUICK DEMO QR SIMULATION:',
              style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800, color: Colors.grey),
            ),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                ActionChip(
                  avatar: const Icon(Icons.qr_code, size: 16),
                  label: const Text('Weighbridge Certificate'),
                  onPressed: () {
                    _tokenController.text = 'LM-CERT-2025-001';
                    _verifyToken('LM-CERT-2025-001');
                  },
                ),
                ActionChip(
                  avatar: const Icon(Icons.qr_code, size: 16),
                  label: const Text('Petrol Flowmeter'),
                  onPressed: () {
                    _tokenController.text = 'LM-CERT-2025-002';
                    _verifyToken('LM-CERT-2025-002');
                  },
                ),
                ActionChip(
                  avatar: const Icon(Icons.qr_code, size: 16),
                  label: const Text('Platform Counter Scale'),
                  onPressed: () {
                    _tokenController.text = 'LM-CERT-2025-003';
                    _verifyToken('LM-CERT-2025-003');
                  },
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

// ==============================================================================
// 2. PUBLIC CERTIFICATE DETAILS PAGE (SHOWS PUBLIC DATA ONLY + FILE COMPLAINT)
// ==============================================================================
class PublicCertificateVerificationPage extends StatelessWidget {
  final Map<String, dynamic> certificate;
  final String baseUrl;

  const PublicCertificateVerificationPage({
    super.key,
    required this.certificate,
    required this.baseUrl,
  });

  @override
  Widget build(BuildContext context) {
    final status = (certificate['status'] ?? 'VALID').toString().toUpperCase();
    final isValid = status == 'VALID';
    final isRevoked = status == 'REVOKED';

    final statusColor = isValid
        ? const Color(0xFF16A34A)
        : (isRevoked ? const Color(0xFFDC2626) : const Color(0xFFD97706));

    final statusBg = isValid
        ? const Color(0xFFDCFCE7)
        : (isRevoked ? const Color(0xFFFEE2E2) : const Color(0xFFFEF3C7));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Certificate Verification'),
        backgroundColor: const Color(0xFF0B559F),
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Status Header Banner
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: statusBg,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: statusColor.withOpacity(0.4), width: 1.5),
              ),
              child: Column(
                children: [
                  Icon(
                    isValid ? Icons.verified_rounded : (isRevoked ? Icons.cancel_rounded : Icons.warning_amber_rounded),
                    color: statusColor,
                    size: 48,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    isValid ? 'GENUINE & VERIFIED' : (isRevoked ? 'CERTIFICATE REVOKED' : 'VERIFICATION EXPIRED'),
                    style: TextStyle(color: statusColor, fontSize: 18, fontWeight: FontWeight.w900, letterSpacing: 0.5),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    certificate['issuing_authority'] ?? 'Legal Metrology Department, Government of India',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: statusColor.withOpacity(0.85), fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),

            // Public Certificate Specs Card
            Card(
              elevation: 2,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              child: Padding(
                padding: const EdgeInsets.all(18.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Public Verification Details',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Color(0xFF0B559F)),
                    ),
                    const Divider(height: 24),
                    _buildDetailRow('Certificate Number', certificate['certificate_number'] ?? '—', isBold: true),
                    _buildDetailRow('Instrument ID', certificate['instrument_id'] ?? '—'),
                    _buildDetailRow('Type / Category', '${certificate['instrument_type'] ?? '—'} (${certificate['category'] ?? 'Standard'})'),
                    _buildDetailRow('Manufacturer', '${certificate['manufacturer'] ?? '—'} ${certificate['model'] ?? ''}'),
                    _buildDetailRow('Serial Number', certificate['serial_number'] ?? '—'),
                    _buildDetailRow('Verification Date', certificate['verification_date'] ?? '—'),
                    _buildDetailRow('Valid Until', certificate['valid_until'] ?? '—', isBold: true),
                    if (certificate['owner_name'] != null)
                      _buildDetailRow('Establishment', certificate['owner_name']),
                    if (certificate['district'] != null)
                      _buildDetailRow('Jurisdiction', '${certificate['district']}, ${certificate['state'] ?? 'Tamil Nadu'}'),
                    _buildDetailRow(
                      'Cryptographic Hash',
                      certificate['certificate_hash_verified'] == true ? '✓ SHA-256 Valid (Tamper-Free)' : '✖ Hash Mismatch',
                      valueColor: certificate['certificate_hash_verified'] == true ? Colors.green.shade700 : Colors.red,
                    ),
                    if (certificate['revocation_reason'] != null)
                      _buildDetailRow('Revocation Note', certificate['revocation_reason'], valueColor: Colors.red),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 28),

            // PRIMARY CALL TO ACTION: FILE COMPLAINT
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: Colors.red.shade50,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: Colors.red.shade200),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Row(
                    children: [
                      Icon(Icons.gavel_rounded, color: Color(0xFFDC2626)),
                      SizedBox(width: 8),
                      Text(
                        'Consumer Protection & Grievance',
                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: Color(0xFFDC2626)),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  const Text(
                    'Noticed short weights, tampered seals, or unverified measuring scales at this establishment?',
                    style: TextStyle(fontSize: 13, color: Colors.black87),
                  ),
                  const SizedBox(height: 14),
                  ElevatedButton.icon(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => MobileCitizenComplaintPage(
                            cert: certificate,
                            baseUrl: baseUrl,
                          ),
                        ),
                      );
                    },
                    icon: const Icon(Icons.report_problem),
                    label: const Text('⚖️ File Complaint / Report Violation', style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFDC2626),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      elevation: 3,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(String label, String value, {bool isBold = false, Color? valueColor}) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 130,
            child: Text(label, style: const TextStyle(color: Colors.black54, fontSize: 13, fontWeight: FontWeight.w600)),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                fontSize: 13,
                fontWeight: isBold ? FontWeight.bold : FontWeight.w500,
                color: valueColor ?? Colors.black87,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ==============================================================================
// 3. MOBILE CITIZEN COMPLAINT WIZARD (WITH PRE-FILLED INFO & DUAL OTP)
// ==============================================================================
class MobileCitizenComplaintPage extends StatefulWidget {
  final Map<String, dynamic> cert;
  final String baseUrl;

  const MobileCitizenComplaintPage({
    super.key,
    required this.cert,
    required this.baseUrl,
  });

  @override
  State<MobileCitizenComplaintPage> createState() => _MobileCitizenComplaintPageState();
}

class _MobileCitizenComplaintPageState extends State<MobileCitizenComplaintPage> {
  int _step = 1; // 1: Citizen OTP, 2: Grievance Details, 3: Evidence & GPS, 4: Confirmed
  bool _busy = false;
  String _toast = '';

  // Step 1: Citizen Identity & OTP
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _emailController = TextEditingController();
  final _otpController = TextEditingController();
  String _verificationToken = '';
  bool _isVerified = false;

  // Step 2: Violation & Shop Info (Pre-filled from scanned cert)
  late TextEditingController _shopNameController;
  late TextEditingController _shopAddressController;
  late TextEditingController _districtController;
  late TextEditingController _stateController;
  String _violationType = 'Short Weight / Short Measure';
  String _severity = 'MEDIUM';
  late TextEditingController _descController;

  // Step 3: GPS & Evidence
  double? _latitude;
  double? _longitude;
  String _gpsStatus = '';
  List<XFile> _evidencePhotos = [];

  // Step 4: Submission Ticket
  Map<String, dynamic>? _submittedTicket;

  @override
  void initState() {
    super.initState();
    final c = widget.cert;
    _shopNameController = TextEditingController(text: c['owner_name'] ?? 'Commercial Shop / Merchant');
    _shopAddressController = TextEditingController(text: c['owner_address'] ?? c['district'] ?? '');
    _districtController = TextEditingController(text: c['district'] ?? 'Chennai');
    _stateController = TextEditingController(text: c['state'] ?? 'Tamil Nadu');
    _descController = TextEditingController(
      text: 'Grievance regarding verified instrument: ${c['instrument_type'] ?? 'Scale'} (Cert: ${c['certificate_number'] ?? 'N/A'}, S/N: ${c['serial_number'] ?? 'N/A'}). Discrepancy observed in weights.',
    );
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _emailController.dispose();
    _otpController.dispose();
    _shopNameController.dispose();
    _shopAddressController.dispose();
    _districtController.dispose();
    _stateController.dispose();
    _descController.dispose();
    super.dispose();
  }

  // Send OTP
  Future<void> _sendOtp() async {
    final phone = _phoneController.text.replaceAll(RegExp(r'\D'), '');
    final email = _emailController.text.trim();

    if (phone.length < 10) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enter a valid 10-digit phone number.')));
      return;
    }
    if (!email.contains('@')) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enter a valid email address.')));
      return;
    }

    setState(() => _busy = true);
    try {
      final res = await http.post(
        Uri.parse('${widget.baseUrl}/complaints/otp/send'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'phone': phone,
          'email': email,
          'citizen_name': _nameController.text.trim(),
        }),
      );

      if (res.statusCode == 200) {
        final d = jsonDecode(res.body);
        setState(() {
          _verificationToken = d['verification_token'] ?? '';
          _toast = d['message'] ?? 'OTP successfully dispatched to Mobile and Email.';
        });
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(_toast)));
      } else {
        final err = jsonDecode(res.body);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(err['detail'] ?? 'Failed to send OTP.')));
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Network error: $e')));
    } finally {
      setState(() => _busy = false);
    }
  }

  // Verify OTP
  Future<void> _verifyOtp() async {
    final phone = _phoneController.text.replaceAll(RegExp(r'\D'), '');
    final otp = _otpController.text.trim();

    if (otp.length != 6) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please enter complete 6-digit OTP code.')));
      return;
    }

    setState(() => _busy = true);
    try {
      final res = await http.post(
        Uri.parse('${widget.baseUrl}/complaints/otp/verify'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'phone': phone,
          'otp': otp,
          'verification_token': _verificationToken,
        }),
      );

      if (res.statusCode == 200) {
        setState(() {
          _isVerified = true;
          _step = 2; // Move to Step 2
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('✓ Identity verified! Review establishment & violation details.')),
        );
      } else {
        final err = jsonDecode(res.body);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(err['detail'] ?? 'Invalid or expired OTP.')));
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Network error: $e')));
    } finally {
      setState(() => _busy = false);
    }
  }

  // Capture GPS
  Future<void> _captureGps() async {
    setState(() => _gpsStatus = 'Acquiring GPS coordinates…');
    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      final pos = await Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
      setState(() {
        _latitude = pos.latitude;
        _longitude = pos.longitude;
        _gpsStatus = 'Lat: ${_latitude!.toStringAsFixed(5)}, Lng: ${_longitude!.toStringAsFixed(5)}';
      });
    } catch (e) {
      setState(() {
        _latitude = 13.0827; // Default Chennai
        _longitude = 80.2707;
        _gpsStatus = 'Lat: 13.08270, Lng: 80.27070 (Simulated)';
      });
    }
  }

  // Pick Evidence Photo
  Future<void> _pickEvidence() async {
    final picker = ImagePicker();
    final picked = await picker.pickImage(source: ImageSource.camera);
    if (picked != null) {
      setState(() {
        _evidencePhotos.add(picked);
      });
    }
  }

  // Submit Complaint
  Future<void> _submitComplaint() async {
    setState(() => _busy = true);
    final phone = _phoneController.text.replaceAll(RegExp(r'\D'), '');

    try {
      final res = await http.post(
        Uri.parse('${widget.baseUrl}/complaints'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'citizen_name': _nameController.text.trim().isNotEmpty ? _nameController.text.trim() : 'Verified Citizen',
          'citizen_phone': phone,
          'citizen_email': _emailController.text.trim(),
          'shop_name': _shopNameController.text.trim(),
          'shop_address': _shopAddressController.text.trim(),
          'state': _stateController.text.trim(),
          'district': _districtController.text.trim(),
          'violation_type': _violationType,
          'complaint_category': 'INCORRECT_WEIGHT',
          'severity': _severity,
          'description': _descController.text.trim(),
          'qr_token': widget.cert['qr_token'] ?? widget.cert['certificate_number'],
          'latitude': _latitude ?? 13.0827,
          'longitude': _longitude ?? 80.2707,
          'verification_token': _verificationToken,
        }),
      );

      if (res.statusCode == 200 || res.statusCode == 201) {
        final ticket = jsonDecode(res.body);
        setState(() {
          _submittedTicket = ticket;
          _step = 4;
        });
      } else {
        final err = jsonDecode(res.body);
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(err['detail'] ?? 'Submission failed.')));
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: $e')));
    } finally {
      setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_step == 4 ? 'Grievance Registered' : 'File Grievance (Step $_step of 3)'),
        backgroundColor: const Color(0xFF0B559F),
        foregroundColor: Colors.white,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: _buildCurrentStep(),
      ),
    );
  }

  Widget _buildCurrentStep() {
    switch (_step) {
      case 1:
        return _buildStep1Identity();
      case 2:
        return _buildStep2Violation();
      case 3:
        return _buildStep3Evidence();
      case 4:
        return _buildStep4Success();
      default:
        return const SizedBox.shrink();
    }
  }

  // STEP 1: CITIZEN IDENTITY & OTP
  Widget _buildStep1Identity() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: const Color(0xFFEFF6FF),
            border: Border.all(color: const Color(0xFFBFDBFE)),
            borderRadius: BorderRadius.circular(10),
          ),
          child: Row(
            children: [
              const Icon(Icons.qr_code_2, color: Color(0xFF1D4ED8)),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'Pre-filled for: ${widget.cert['owner_name'] ?? 'Establishment'}\nInstrument: ${widget.cert['instrument_type'] ?? 'Scale'}',
                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: Color(0xFF1E40AF)),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),
        const Text('1. Verified Citizen Identity', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const Text(
          'Under Legal Metrology Act 2009, consumer grievances require verified citizen contact credentials for real-time status dispatch.',
          style: TextStyle(color: Colors.black54, fontSize: 13),
        ),
        const SizedBox(height: 18),
        TextField(
          controller: _nameController,
          decoration: const InputDecoration(labelText: 'Citizen Full Name', prefixIcon: Icon(Icons.person)),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _phoneController,
          keyboardType: TextInputType.phone,
          maxLength: 10,
          decoration: const InputDecoration(labelText: 'Mobile Phone Number *', prefixIcon: Icon(Icons.phone_android)),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _emailController,
          keyboardType: TextInputType.emailAddress,
          decoration: const InputDecoration(labelText: 'Email Address (For Status Alerts) *', prefixIcon: Icon(Icons.email)),
        ),
        const SizedBox(height: 16),

        if (_verificationToken.isEmpty)
          ElevatedButton.icon(
            onPressed: _busy ? null : _sendOtp,
            icon: const Icon(Icons.sms),
            label: _busy ? const CircularProgressIndicator(color: Colors.white) : const Text('📲 Dispatch 6-Digit Secure OTP'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF0B559F),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
          )
        else ...[
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: Colors.green.shade50, borderRadius: BorderRadius.circular(8)),
            child: const Text('✓ OTP sent to Mobile & Email. Enter 6-digit code below:'),
          ),
          const SizedBox(height: 14),
          TextField(
            controller: _otpController,
            keyboardType: TextInputType.number,
            maxLength: 6,
            textAlign: TextAlign.center,
            style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, letterSpacing: 8),
            decoration: const InputDecoration(hintText: '• • • • • •'),
          ),
          const SizedBox(height: 14),
          ElevatedButton.icon(
            onPressed: _busy ? null : _verifyOtp,
            icon: const Icon(Icons.check_circle),
            label: _busy ? const CircularProgressIndicator(color: Colors.white) : const Text('✓ Verify OTP & Continue'),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color(0xFF16A34A),
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
            ),
          ),
        ],
      ],
    );
  }

  // STEP 2: VIOLATION DETAILS
  Widget _buildStep2Violation() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text('2. Commercial Shop & Violation', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 16),
        TextField(controller: _shopNameController, decoration: const InputDecoration(labelText: 'Establishment / Merchant Name')),
        const SizedBox(height: 12),
        TextField(controller: _shopAddressController, decoration: const InputDecoration(labelText: 'Shop Location / Market Address')),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(child: TextField(controller: _districtController, decoration: const InputDecoration(labelText: 'District'))),
            const SizedBox(width: 10),
            Expanded(child: TextField(controller: _stateController, decoration: const InputDecoration(labelText: 'State'))),
          ],
        ),
        const SizedBox(height: 16),
        DropdownButtonFormField<String>(
          value: _violationType,
          decoration: const InputDecoration(labelText: 'Legal Metrology Violation Type'),
          items: const [
            DropdownMenuItem(value: 'Short Weight / Short Measure', child: Text('Short Weight / Short Measure')),
            DropdownMenuItem(value: 'Tampered Verification Seal / Stamp', child: Text('Tampered Verification Seal')),
            DropdownMenuItem(value: 'Unverified / Expired Instrument', child: Text('Unverified / Expired Scale')),
            DropdownMenuItem(value: 'Incorrect Tare / Packaging Discrepancy', child: Text('Incorrect Tare Weight')),
            DropdownMenuItem(value: 'Overcharging Above Standard MRP', child: Text('Overcharging / MRP Violation')),
          ],
          onChanged: (val) => setState(() => _violationType = val ?? _violationType),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _descController,
          maxLines: 3,
          decoration: const InputDecoration(labelText: 'Detailed Incident Statement *', hintText: 'Specify discrepancy details...'),
        ),
        const SizedBox(height: 24),
        ElevatedButton(
          onPressed: () => setState(() => _step = 3),
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF0B559F),
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 14),
          ),
          child: const Text('Next: Attach GPS & Evidence →'),
        ),
      ],
    );
  }

  // STEP 3: GPS & EVIDENCE
  Widget _buildStep3Evidence() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text('3. Evidence & Geotag Verification', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
        const SizedBox(height: 16),
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.grey.shade100,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: Colors.grey.shade300),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Text('📍 On-Site Geotag GPS (For LMO Inspection)', style: TextStyle(fontWeight: FontWeight.bold)),
              const SizedBox(height: 4),
              Text(_gpsStatus.isNotEmpty ? _gpsStatus : 'Tap button to acquire GPS coordinates', style: const TextStyle(color: Colors.black54, fontSize: 12)),
              const SizedBox(height: 10),
              OutlinedButton.icon(
                onPressed: _captureGps,
                icon: const Icon(Icons.my_location),
                label: const Text('Acquire Accurate GPS Coordinates'),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),
        OutlinedButton.icon(
          onPressed: _pickEvidence,
          icon: const Icon(Icons.camera_alt),
          label: Text('Attach Evidence Photo (${_evidencePhotos.length} Attached)'),
          style: OutlinedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 14)),
        ),
        const SizedBox(height: 28),
        ElevatedButton.icon(
          onPressed: _busy ? null : _submitComplaint,
          icon: const Icon(Icons.gavel),
          label: _busy ? const CircularProgressIndicator(color: Colors.white) : const Text('⚖️ Submit Grievance for Enforcement'),
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFFDC2626),
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 16),
          ),
        ),
      ],
    );
  }

  // STEP 4: SUCCESS TICKET
  Widget _buildStep4Success() {
    final refNo = _submittedTicket?['complaint_number'] ?? 'COMP-2025-REG';
    return Column(
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        const Icon(Icons.check_circle, size: 72, color: Color(0xFF16A34A)),
        const SizedBox(height: 12),
        const Text('Grievance Registered Successfully!', style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Color(0xFF16A34A))),
        const SizedBox(height: 6),
        const Text('Auto-routed to the jurisdictional Legal Metrology Office.', textAlign: TextAlign.center, style: TextStyle(color: Colors.black54)),
        const SizedBox(height: 24),
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: Colors.grey.shade50,
            border: Border.all(color: Colors.grey.shade300),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            children: [
              _buildTicketRow('Reference Number', refNo, isPrimary: true),
              const Divider(height: 20),
              _buildTicketRow('Status', 'SUBMITTED (Pending Field Visit)'),
              const Divider(height: 20),
              _buildTicketRow('Jurisdiction', '${_districtController.text} Enforcement Division'),
              const Divider(height: 20),
              _buildTicketRow('Expected Response', 'Within 48 Working Hours'),
            ],
          ),
        ),
        const SizedBox(height: 28),
        ElevatedButton(
          onPressed: () => Navigator.pop(context),
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF0B559F),
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
          ),
          child: const Text('Done & Return to App'),
        ),
      ],
    );
  }

  Widget _buildTicketRow(String label, String value, {bool isPrimary = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: Colors.black54, fontSize: 13, fontWeight: FontWeight.w600)),
        Text(
          value,
          style: TextStyle(
            fontSize: isPrimary ? 16 : 13,
            fontWeight: FontWeight.bold,
            color: isPrimary ? const Color(0xFF0B559F) : Colors.black87,
          ),
        ),
      ],
    );
  }
}

