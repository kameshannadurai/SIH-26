import pytest
from app.routers.gatc_rules import GATC_CATEGORIES, FeeCalculationRequest, calculate_fee
from fastapi import HTTPException

def test_all_18_categories_present():
    assert len(GATC_CATEGORIES) == 18
    category_ids = {c["id"] for c in GATC_CATEGORIES}
    expected_ids = {
        "water_meter", "sphygmomanometer", "clinical_thermometer", "automatic_rail_weighbridge",
        "tape_measure", "non_auto_weighing_class_3", "non_auto_weighing_class_4", "load_cell",
        "beam_scale", "counter_machine", "weights_all", "gas_meter", "energy_meter",
        "moisture_meter", "speed_meter", "breath_analyser", "multi_dim_measuring", "flow_meter"
    }
    assert category_ids == expected_ids

def test_fixed_fee_categories():
    # Sphygmomanometer = 100
    res = calculate_fee(FeeCalculationRequest(category="sphygmomanometer"))
    assert res["fee"] == 100

    # Clinical Thermometer = 50
    res = calculate_fee(FeeCalculationRequest(category="clinical_thermometer"))
    assert res["fee"] == 50

    # Automatic rail weighbridge = 10000
    res = calculate_fee(FeeCalculationRequest(category="automatic_rail_weighbridge"))
    assert res["fee"] == 10000

    # Tape measure = 100
    res = calculate_fee(FeeCalculationRequest(category="tape_measure"))
    assert res["fee"] == 100

    # Weights of all category = 200
    res = calculate_fee(FeeCalculationRequest(category="weights_all"))
    assert res["fee"] == 200

    # Moisture meter = 2500
    res = calculate_fee(FeeCalculationRequest(category="moisture_meter"))
    assert res["fee"] == 2500

    # Speed meter = 15000
    res = calculate_fee(FeeCalculationRequest(category="speed_meter"))
    assert res["fee"] == 15000

    # Breath analyser = 2500
    res = calculate_fee(FeeCalculationRequest(category="breath_analyser"))
    assert res["fee"] == 2500

    # Multi dimensional measuring = 3600
    res = calculate_fee(FeeCalculationRequest(category="multi_dim_measuring"))
    assert res["fee"] == 3600

def test_water_gas_energy_meter_subtypes():
    # Water Meter
    assert calculate_fee(FeeCalculationRequest(category="water_meter", subtype="domestic"))["fee"] == 250
    assert calculate_fee(FeeCalculationRequest(category="water_meter", subtype="commercial"))["fee"] == 1000
    assert calculate_fee(FeeCalculationRequest(category="water_meter", subtype="industrial"))["fee"] == 2500

    # Gas Meter
    assert calculate_fee(FeeCalculationRequest(category="gas_meter", subtype="domestic"))["fee"] == 500
    assert calculate_fee(FeeCalculationRequest(category="gas_meter", subtype="commercial"))["fee"] == 2000
    assert calculate_fee(FeeCalculationRequest(category="gas_meter", subtype="industrial"))["fee"] == 5000

    # Energy Meter
    assert calculate_fee(FeeCalculationRequest(category="energy_meter", subtype="domestic"))["fee"] == 1000
    assert calculate_fee(FeeCalculationRequest(category="energy_meter", subtype="commercial"))["fee"] == 3000
    assert calculate_fee(FeeCalculationRequest(category="energy_meter", subtype="industrial"))["fee"] == 5000

    # Missing subtype raises 400
    with pytest.raises(HTTPException):
        calculate_fee(FeeCalculationRequest(category="water_meter"))

def test_weighing_scale_capacity_boundaries():
    # Class III scale
    # <= 10 kg -> 2000
    assert calculate_fee(FeeCalculationRequest(category="non_auto_weighing_class_3", capacity_kg=0))["fee"] == 2000
    assert calculate_fee(FeeCalculationRequest(category="non_auto_weighing_class_3", capacity_kg=10))["fee"] == 2000
    # 10.1 - 150 kg -> 3000
    assert calculate_fee(FeeCalculationRequest(category="non_auto_weighing_class_3", capacity_kg=10.1))["fee"] == 3000
    assert calculate_fee(FeeCalculationRequest(category="non_auto_weighing_class_3", capacity_kg=150))["fee"] == 3000
    # > 150 kg -> 5000
    assert calculate_fee(FeeCalculationRequest(category="non_auto_weighing_class_3", capacity_kg=150.1))["fee"] == 5000
    assert calculate_fee(FeeCalculationRequest(category="non_auto_weighing_class_3", capacity_kg=500))["fee"] == 5000

def test_load_cell_capacity_boundaries():
    # <= 5 kN -> 2000
    assert calculate_fee(FeeCalculationRequest(category="load_cell", capacity_kn=0))["fee"] == 2000
    assert calculate_fee(FeeCalculationRequest(category="load_cell", capacity_kn=5))["fee"] == 2000
    # 5.1 - 100 kN -> 5000
    assert calculate_fee(FeeCalculationRequest(category="load_cell", capacity_kn=5.1))["fee"] == 5000
    assert calculate_fee(FeeCalculationRequest(category="load_cell", capacity_kn=100))["fee"] == 5000
    # > 100 kN -> 8000
    assert calculate_fee(FeeCalculationRequest(category="load_cell", capacity_kn=100.5))["fee"] == 8000

def test_beam_scale_and_counter_machine():
    assert calculate_fee(FeeCalculationRequest(category="beam_scale", capacity_kg=5))["fee"] == 500
    assert calculate_fee(FeeCalculationRequest(category="beam_scale", capacity_kg=6))["fee"] == 1000

    assert calculate_fee(FeeCalculationRequest(category="counter_machine", capacity_kg=5))["fee"] == 500
    assert calculate_fee(FeeCalculationRequest(category="counter_machine", capacity_kg=50))["fee"] == 1000

def test_flow_meter_size_boundaries():
    # <= 100 mm -> 5000
    assert calculate_fee(FeeCalculationRequest(category="flow_meter", size_mm=50))["fee"] == 5000
    assert calculate_fee(FeeCalculationRequest(category="flow_meter", size_mm=100))["fee"] == 5000
    # 101-125 mm (1 step) -> 6000
    assert calculate_fee(FeeCalculationRequest(category="flow_meter", size_mm=101))["fee"] == 6000
    assert calculate_fee(FeeCalculationRequest(category="flow_meter", size_mm=125))["fee"] == 6000
    # 126-150 mm (2 steps) -> 7000
    assert calculate_fee(FeeCalculationRequest(category="flow_meter", size_mm=150))["fee"] == 7000
