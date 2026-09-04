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
          IconButton(icon: const Icon(Icons.cloud_sync), tooltip: 'Sync Drafts', onPressed: _syncDrafts),
          IconButton(icon: const Icon(Icons.refresh), tooltip: 'Refresh', onPressed: _fetchData),
          IconButton(icon: const Icon(Icons.logout), tooltip: 'Logout', onPressed: _logout),
        ],
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
