/**
 * Official Gazette Statutory Fee Schedule
 * Legal Metrology (Government Approved Test Centre / General) Rules
 * Verification and Stamping Schedule Fees for all 18 categories + commercial devices
 */

export const GAZETTE_SCHEDULE = [
  { slNo: 1, id: 'water_meter', name: 'Water meter', description: 'Domestic (₹250), Commercial (₹1,000), Industrial (₹2,500)' },
  { slNo: 2, id: 'sphygmomanometer', name: 'Sphygmomanometer', description: 'Blood pressure gauge / NIBP monitor (₹100)' },
  { slNo: 3, id: 'clinical_thermometer', name: 'Clinical thermometer', description: 'Medical clinical thermometer (₹50)' },
  { slNo: 4, id: 'automatic_rail_weighbridge', name: 'Automatic rail weighbridges', description: 'Weighing-in-motion rail vehicle scale (₹5,000)' },
  { slNo: 5, id: 'tape_measure', name: 'Tape measures', description: 'Class I (₹2/m), Class II (₹1/m), Class III (₹0.50/m)' },
  { slNo: 6, id: 'non_auto_weighing_class_3', name: 'Non-automatic weighing instruments (Class III)', description: 'Upto 10 kg (₹2,000), 10–150 kg (₹3,000)' },
  { slNo: 7, id: 'non_auto_weighing_class_4', name: 'Non-automatic weighing instruments (Class IIII)', description: 'Upto 10 kg (₹2,000), 10–150 kg (₹3,000)' },
  { slNo: 8, id: 'load_cell', name: 'Load cell', description: 'Upto 5 kN (₹2,000), Above 5 kN to 100 kN (₹5,000)' },
  { slNo: 9, id: 'beam_scale', name: 'Beam scale', description: 'Upto 5 kg (₹500), Above 5 kg (₹1,000)' },
  { slNo: 10, id: 'counter_machine', name: 'Counter machine', description: 'Upto 5 kg (₹500), Above 5 kg (₹1,000)' },
  { slNo: 11, id: 'weights_all', name: 'Weights of all category', description: 'E1 Class set (₹15,000), Assorted (₹1,000-₹2,000), Bullion/Carat/Hex' },
  { slNo: 12, id: 'gas_meter', name: 'Gas meters', description: 'Domestic (₹500), Commercial (₹2,000), Industrial (₹5,000)' },
  { slNo: 13, id: 'energy_meter', name: 'Energy meters', description: 'Domestic (₹1,000), Commercial (₹3,000), Industrial (₹5,000)' },
  { slNo: 14, id: 'moisture_meter', name: 'Moisture meters', description: 'Grain & seed moisture tester (₹2,500)' },
  { slNo: 15, id: 'speed_meter', name: 'Speed meters for vehicles', description: 'Radar/Laser vehicle speed detector (₹15,000)' },
  { slNo: 16, id: 'breath_analyser', name: 'Breath analysers', description: 'Evidential alcohol breath analyser (₹2,500)' },
  { slNo: 17, id: 'multi_dim_measuring', name: 'Multi-dimensional measuring instruments', description: 'Automated 3D volumetric scanner (₹3,600)' },
  { slNo: 18, id: 'flow_meter', name: 'Flow meters', description: 'Upto 100mm (₹5,000), Above 100mm (₹5,000 + ₹1,000/25mm)' },
];

/**
 * Parses numeric capacity from a string like "30 kg", "15 mm", "50 m", "5000 kg", "100 kN"
 */
function parseNumericValue(str) {
  if (!str) return null;
  const match = String(str).match(/([0-9]+(?:\.[0-9]+)?)/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Computes exact statutory verification fee per the Gazette schedule for a given instrument.
 * @param {Object} inst - Instrument object
 * @returns {Object} { fee, categoryLabel, ruleDescription, gazetteSlNo }
 */
export function calculateGazetteStatutoryFee(inst) {
  if (!inst) return { fee: 500, categoryLabel: 'Standard Instrument', ruleDescription: 'Standard Verification Fee', gazetteSlNo: '-' };

  const cat = (inst.category || inst.instrument_type || '').toLowerCase().trim();
  const capStr = (inst.capacity || '').toLowerCase();
  const modelStr = (inst.model || '').toLowerCase();
  const classStr = (inst.accuracy_class || '').toLowerCase();
  const capNum = parseNumericValue(inst.capacity);

  // 1. Water Meter
  if (cat.includes('water_meter') || cat.includes('water meter')) {
    if (capStr.includes('ind') || modelStr.includes('ind')) {
      return { fee: 2500, categoryLabel: 'Water Meter (Industrial)', ruleDescription: 'Sl. 1(iii) Industrial water meter', gazetteSlNo: 1 };
    }
    if (capStr.includes('comm') || modelStr.includes('comm')) {
      return { fee: 1000, categoryLabel: 'Water Meter (Commercial)', ruleDescription: 'Sl. 1(ii) Commercial water meter', gazetteSlNo: 1 };
    }
    // Default / Domestic
    return { fee: 250, categoryLabel: 'Water Meter (Domestic)', ruleDescription: 'Sl. 1(i) Domestic water meter', gazetteSlNo: 1 };
  }

  // 2. Sphygmomanometer
  if (cat.includes('sphygmomanometer') || cat.includes('blood pressure')) {
    return { fee: 100, categoryLabel: 'Sphygmomanometer', ruleDescription: 'Sl. 2 Sphygmomanometer verification fee', gazetteSlNo: 2 };
  }

  // 3. Clinical Thermometer
  if (cat.includes('clinical_thermometer') || cat.includes('thermometer')) {
    return { fee: 50, categoryLabel: 'Clinical Thermometer', ruleDescription: 'Sl. 3 Clinical thermometer verification fee', gazetteSlNo: 3 };
  }

  // 4. Automatic Rail Weighbridge
  if (cat.includes('rail_weighbridge') || cat.includes('rail') || (cat.includes('weighbridge') && capStr.includes('rail'))) {
    return { fee: 5000, categoryLabel: 'Automatic Rail Weighbridge', ruleDescription: 'Sl. 4 Automatic rail weighbridges (State Schedule)', gazetteSlNo: 4 };
  }

  // 5. Tape Measures
  if (cat.includes('tape_measure') || cat.includes('tape')) {
    const meters = capNum || 50;
    if (classStr.includes('class i') && !classStr.includes('class ii')) {
      const fee = Math.max(50, Math.ceil(meters * 2.0));
      return { fee, categoryLabel: `Tape Measure Class I (${meters}m)`, ruleDescription: `Sl. 5(i) Class I: ₹2.00 per meter (${meters}m)`, gazetteSlNo: 5 };
    }
    if (classStr.includes('class iii')) {
      const fee = Math.max(25, Math.ceil(meters * 0.5));
      return { fee, categoryLabel: `Tape Measure Class III (${meters}m)`, ruleDescription: `Sl. 5(iii) Class III: ₹0.50 per meter (${meters}m)`, gazetteSlNo: 5 };
    }
    // Class II default
    const fee = Math.max(50, Math.ceil(meters * 1.0));
    return { fee, categoryLabel: `Tape Measure Class II (${meters}m)`, ruleDescription: `Sl. 5(ii) Class II: ₹1.00 per meter (${meters}m)`, gazetteSlNo: 5 };
  }

  // 6. Non-automatic weighing instruments (Class III)
  if (cat.includes('non_auto_weighing_class_3') || (cat.includes('non_auto') && classStr.includes('iii') && !classStr.includes('iiii'))) {
    const kg = capNum || 30;
    if (kg <= 10) {
      return { fee: 2000, categoryLabel: `Non-Auto Weighing Class III (≤10kg)`, ruleDescription: 'Sl. 6(i) Class III upto 10 kg', gazetteSlNo: 6 };
    }
    return { fee: 3000, categoryLabel: `Non-Auto Weighing Class III (${kg}kg)`, ruleDescription: 'Sl. 6(ii) Class III above 10 kg upto 150 kg', gazetteSlNo: 6 };
  }

  // 7. Non-automatic weighing instruments (Class IIII)
  if (cat.includes('non_auto_weighing_class_4') || (cat.includes('non_auto') && (classStr.includes('iiii') || classStr.includes('iv')))) {
    const kg = capNum || 500;
    if (kg <= 10) {
      return { fee: 2000, categoryLabel: `Non-Auto Weighing Class IIII (≤10kg)`, ruleDescription: 'Sl. 7(i) Class IIII upto 10 kg', gazetteSlNo: 7 };
    }
    return { fee: 3000, categoryLabel: `Non-Auto Weighing Class IIII (${kg}kg)`, ruleDescription: 'Sl. 7(ii) Class IIII above 10 kg upto 150 kg', gazetteSlNo: 7 };
  }

  // 8. Load Cell
  if (cat.includes('load_cell') || cat.includes('load cell')) {
    // 5000 kg is approx 50 kN; 5 kN is approx 500 kg
    let kn = capNum || 50;
    if (capStr.includes('kg')) {
      kn = (capNum || 5000) / 100; // convert approx kg to kN
    }
    if (kn <= 5) {
      return { fee: 2000, categoryLabel: `Load Cell (≤5 kN)`, ruleDescription: 'Sl. 8(i) Load cell upto 5 kN', gazetteSlNo: 8 };
    }
    return { fee: 5000, categoryLabel: `Load Cell (${inst.capacity || '>5 kN'})`, ruleDescription: 'Sl. 8(ii) Load cell above 5 kN to 100 kN', gazetteSlNo: 8 };
  }

  // 9. Beam Scale
  if (cat.includes('beam_scale') || cat.includes('beam scale')) {
    const kg = capNum || 5;
    if (kg <= 5) {
      return { fee: 500, categoryLabel: 'Beam Scale (≤5 kg)', ruleDescription: 'Sl. 9(i) Beam scale upto 5 kg', gazetteSlNo: 9 };
    }
    return { fee: 1000, categoryLabel: `Beam Scale (${kg} kg)`, ruleDescription: 'Sl. 9(ii) Beam scale above 5 kg', gazetteSlNo: 9 };
  }

  // 10. Counter Machine
  if (cat.includes('counter_machine') || cat.includes('counter machine')) {
    const kg = capNum || 10;
    if (kg <= 5) {
      return { fee: 500, categoryLabel: 'Counter Machine (≤5 kg)', ruleDescription: 'Sl. 10(i) Counter machine upto 5 kg', gazetteSlNo: 10 };
    }
    return { fee: 1000, categoryLabel: `Counter Machine (${kg} kg)`, ruleDescription: 'Sl. 10(ii) Counter machine above 5 kg', gazetteSlNo: 10 };
  }

  // 11. Weights of all categories
  if (cat.includes('weights_all') || cat.includes('weight')) {
    if (classStr.includes('e1')) {
      return { fee: 15000, categoryLabel: 'Weights E1 Class Set (22 pcs)', ruleDescription: 'Sl. 11(i)(A) E1 Class set 1mg-200g', gazetteSlNo: 11 };
    }
    if (classStr.includes('e2')) {
      return { fee: 7500, categoryLabel: 'Weights E2 Class Set', ruleDescription: 'Sl. 11(ii) E2 class weights (half E1)', gazetteSlNo: 11 };
    }
    if (classStr.includes('f1')) {
      return { fee: 3750, categoryLabel: 'Weights F1 Class Set', ruleDescription: 'Sl. 11(iii) F1 class weights (quarter E1)', gazetteSlNo: 11 };
    }
    if (classStr.includes('bullion')) {
      return { fee: 50, categoryLabel: 'Bullion Weights', ruleDescription: 'Sl. 11(v) Bullion weights per weight', gazetteSlNo: 11 };
    }
    if (classStr.includes('carat')) {
      return { fee: 50, categoryLabel: 'Carat Weights', ruleDescription: 'Sl. 11(vi) Carat weights per weight', gazetteSlNo: 11 };
    }
    const kg = capNum || 20;
    if (kg <= 10) {
      return { fee: 1000, categoryLabel: `Cast Iron / Brass Weights (≤10kg)`, ruleDescription: 'Sl. 11(i)(B)(a) Assorted weights upto 10 kg', gazetteSlNo: 11 };
    }
    return { fee: 2000, categoryLabel: `Weights Set (${inst.capacity || '10-50kg'})`, ruleDescription: 'Sl. 11(i)(B)(b) Assorted weights 10-50 kg', gazetteSlNo: 11 };
  }

  // 12. Gas Meters
  if (cat.includes('gas_meter') || cat.includes('gas meter')) {
    if (capStr.includes('ind') || modelStr.includes('ind')) {
      return { fee: 5000, categoryLabel: 'Gas Meter (Industrial)', ruleDescription: 'Sl. 12(iii) Industrial gas meter', gazetteSlNo: 12 };
    }
    if (capStr.includes('comm') || modelStr.includes('comm') || modelStr.includes('commercial')) {
      return { fee: 2000, categoryLabel: 'Gas Meter (Commercial)', ruleDescription: 'Sl. 12(ii) Commercial gas meter', gazetteSlNo: 12 };
    }
    return { fee: 500, categoryLabel: 'Gas Meter (Domestic)', ruleDescription: 'Sl. 12(i) Domestic gas meter', gazetteSlNo: 12 };
  }

  // 13. Energy Meters
  if (cat.includes('energy_meter') || cat.includes('energy meter') || cat.includes('electricity')) {
    if (capStr.includes('ind') || modelStr.includes('ind') || modelStr.includes('industrial') || modelStr.includes('3-phase') || modelStr.includes('3 phase')) {
      return { fee: 5000, categoryLabel: 'Energy Meter (Industrial 3-Phase)', ruleDescription: 'Sl. 13(iii) Industrial energy meter', gazetteSlNo: 13 };
    }
    if (capStr.includes('comm') || modelStr.includes('comm')) {
      return { fee: 3000, categoryLabel: 'Energy Meter (Commercial)', ruleDescription: 'Sl. 13(ii) Commercial energy meter', gazetteSlNo: 13 };
    }
    return { fee: 1000, categoryLabel: 'Energy Meter (Domestic)', ruleDescription: 'Sl. 13(i) Domestic energy meter', gazetteSlNo: 13 };
  }

  // 14. Moisture Meter
  if (cat.includes('moisture_meter') || cat.includes('moisture')) {
    return { fee: 2500, categoryLabel: 'Moisture Meter', ruleDescription: 'Sl. 14 Grain moisture meter verification', gazetteSlNo: 14 };
  }

  // 15. Speed Meter
  if (cat.includes('speed_meter') || cat.includes('speed meter') || cat.includes('radar')) {
    return { fee: 15000, categoryLabel: 'Speed Meter for Vehicles', ruleDescription: 'Sl. 15 Doppler radar / speed measurement device', gazetteSlNo: 15 };
  }

  // 16. Breath Analyser
  if (cat.includes('breath_analyser') || cat.includes('breath')) {
    return { fee: 2500, categoryLabel: 'Breath Analyser', ruleDescription: 'Sl. 16 Evidential alcohol breath analyser', gazetteSlNo: 16 };
  }

  // 17. Multi-Dimensional Measuring Instrument
  if (cat.includes('multi_dim_measuring') || cat.includes('multi_dim') || cat.includes('dimension') || cat.includes('volumetric')) {
    return { fee: 3600, categoryLabel: 'Multi-Dimensional Measuring Instrument', ruleDescription: 'Sl. 17 Package cubing & dimension scanner', gazetteSlNo: 17 };
  }

  // 18. Flow Meter
  if (cat.includes('flow_meter') || cat.includes('flow meter') || cat.includes('coriolis') || cat.includes('mass flow')) {
    const sizeMm = capNum && capStr.includes('mm') ? capNum : 50;
    if (sizeMm <= 100) {
      return { fee: 5000, categoryLabel: `Flow Meter (≤100mm)`, ruleDescription: 'Sl. 18(i) Flow meter upto 100 mm', gazetteSlNo: 18 };
    }
    const extra = sizeMm - 100;
    const steps = Math.ceil(extra / 25);
    const fee = 5000 + (steps * 1000);
    return { fee, categoryLabel: `Flow Meter (${sizeMm}mm)`, ruleDescription: `Sl. 18(ii) Flow meter >100mm (₹5,000 + ₹${steps * 1000})`, gazetteSlNo: 18 };
  }

  // Generic Non-GATC / Commercial Weighing & Measuring Devices
  if (cat.includes('gold_balance') || cat.includes('carat')) {
    return { fee: 2000, categoryLabel: 'Precision Carat / Gold Balance', ruleDescription: 'General Weighing Instruments Class II', gazetteSlNo: 6 };
  }
  if (cat.includes('dispenser') || cat.includes('fuel')) {
    return { fee: 2500, categoryLabel: 'Fuel Dispenser Nozzle Unit', ruleDescription: 'Commercial Petroleum Flow Dispenser', gazetteSlNo: 18 };
  }
  if (cat.includes('weighbridge') || cat.includes('tanker')) {
    return { fee: 5000, categoryLabel: 'Commercial Lorry / Tanker Weighbridge', ruleDescription: 'Heavy Industrial Weighbridge Schedule', gazetteSlNo: 6 };
  }
  if (cat.includes('platform_scale')) {
    return { fee: 3000, categoryLabel: 'Heavy Industrial Platform Scale', ruleDescription: 'Industrial Non-Automatic Weighing Instrument', gazetteSlNo: 6 };
  }

  return { fee: 1000, categoryLabel: inst.category || 'Commercial Measuring Device', ruleDescription: 'Standard Verification Fee Schedule', gazetteSlNo: '-' };
}

/**
 * Calculates total fees for an array of selected instruments.
 */
export function calculateBatchVerificationFees(selectedInstruments = [], stampFeePerBatch = 100, taxRate = 0.18) {
  const items = selectedInstruments.map(inst => {
    const feeInfo = calculateGazetteStatutoryFee(inst);
    return {
      instrument_id: inst.instrument_id,
      name: `${inst.manufacturer || ''} ${inst.model || ''}`.trim() || inst.instrument_id,
      category: inst.category || inst.instrument_type,
      categoryLabel: feeInfo.categoryLabel,
      ruleDescription: feeInfo.ruleDescription,
      gazetteSlNo: feeInfo.gazetteSlNo,
      amount: feeInfo.fee,
      capacity: inst.capacity || '-',
      accuracyClass: inst.accuracy_class || '-'
    };
  });

  const subtotalBaseFee = items.reduce((acc, it) => acc + it.amount, 0);
  const stampFee = items.length > 0 ? stampFeePerBatch : 0;
  const taxableAmount = subtotalBaseFee + stampFee;
  const gstAmount = Math.round(taxableAmount * taxRate);
  const totalPayable = taxableAmount + gstAmount;

  return {
    items,
    count: items.length,
    subtotalBaseFee,
    stampFee,
    taxableAmount,
    gstAmount,
    totalPayable
  };
}
