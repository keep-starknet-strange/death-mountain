// SPDX-License-Identifier: MIT

// a randomised deterministic marketplace
use core::poseidon::poseidon_hash_span;
use death_mountain::constants::combat::CombatEnums::Tier;
use death_mountain::constants::loot::{NUM_ITEMS};
use death_mountain::constants::market::{NUMBER_OF_ITEMS_PER_LEVEL, TIER_PRICE};

#[derive(Introspect, Copy, Drop, Serde)]
pub struct ItemPurchase {
    pub item_id: u8,
    pub equip: bool,
}

// @dev: While we could abstract the loop in many of the functions of this class
//       we intentionally don't to provide maximum gas efficieny. For example, we could
//       provide a 'get_market_item_ids' and then have the other functions iterate over that
//       array, but that would require an additional loop and additional gas. Perhaps one of you
//       reading this will be able to find a way to abstract the loop without incurring additional
//       gas costs. If so, I look forward to seeing the associated pull request. Cheers.
#[generate_trait]
pub impl ImplMarket of IMarket {
    // @notice Retrieves the price associated with an item tier.
    // @param tier - A Tier enum indicating the item tier.
    // @return The price as an unsigned 16-bit integer.
    fn get_price(tier: Tier) -> u16 {
        match tier {
            Tier::None(()) => 0,
            Tier::T1(()) => 5 * TIER_PRICE,
            Tier::T2(()) => 4 * TIER_PRICE,
            Tier::T3(()) => 3 * TIER_PRICE,
            Tier::T4(()) => 2 * TIER_PRICE,
            Tier::T5(()) => 1 * TIER_PRICE,
        }
    }

    /// @notice Returns an array of items that are available on the market.
    /// @param seed The seed to be divided.
    /// @param market_size The size of the market.
    /// @return An array of items that are available on the market.
    fn get_available_items(adventurer_id: u64, seed: u64, market_size: u8) -> Array<u8> {
        let mut hash_span = ArrayTrait::<felt252>::new();
        hash_span.append(adventurer_id.into());
        hash_span.append(seed.into());
        let hash: felt252 = poseidon_hash_span(hash_span.span()).into();

        let mut results: Array<u8> = ArrayTrait::new();
        let hash_u256: u256 = hash.into();
        let mut remaining = hash_u256;
        let mut passes: u8 = 0_u8;

        while passes < 31_u8 && results.len() < market_size.into() {
            // Low byte
            let byte_u256 = remaining % 256_u256;
            let byte: u8 = byte_u256.try_into().unwrap();

            // Prepare for the next pass
            remaining = remaining / 256_u256; // right-shift by 8 via division
            passes += 1_u8;

            // Rejection sampling gives perfectly uniform 1-101
            if byte < 202_u8 {
                results.append((byte % 101_u8) + 1_u8);
            }
        };

        results
    }

    /// @notice Returns the size of the market.
    /// @return The size of the market as an unsigned 8-bit integer.
    fn get_market_size() -> u8 {
        NUMBER_OF_ITEMS_PER_LEVEL
    }

    /// @notice Gets a u8 item id from a u64 seed
    /// @param seed a u64 representing a unique seed.
    /// @return a u8 representing the item ID.
    fn get_id(seed: u64) -> u8 {
        (seed % NUM_ITEMS.into()).try_into().unwrap() + 1
    }

    /// @notice Checks if an item is available on the market
    /// @param inventory The inventory of the market
    /// @param item_id The item id to check for availability
    /// @return A boolean indicating if the item is available on the market.
    fn is_item_available(ref inventory: Span<u8>, item_id: u8) -> bool {
        if inventory.len() < NUM_ITEMS.into() {
            loop {
                match inventory.pop_front() {
                    Option::Some(market_item_id) => { if item_id == *market_item_id {
                        break true;
                    } },
                    Option::None(_) => { break false; },
                };
            }
        } else {
            true
        }
    }
}

// ---------------------------
// ---------- Tests ----------
// ---------------------------
#[cfg(test)]
mod tests {
    use death_mountain::constants::combat::CombatEnums::{Tier};
    use death_mountain::constants::loot::{ItemId, NUM_ITEMS};
    use death_mountain::constants::market::{TIER_PRICE};
    use death_mountain::models::market::ImplMarket;

    #[test]
    fn is_item_available() {
        let mut market_inventory = ArrayTrait::<u8>::new();
        market_inventory.append(ItemId::Wand);
        market_inventory.append(ItemId::Book);
        market_inventory.append(ItemId::Katana);
        market_inventory.append(ItemId::GhostWand);
        market_inventory.append(ItemId::DivineHood);
        market_inventory.append(ItemId::DivineSlippers);
        market_inventory.append(ItemId::DivineGloves);
        market_inventory.append(ItemId::ShortSword);
        market_inventory.append(ItemId::GoldRing);
        market_inventory.append(ItemId::Necklace);
        let mut market_inventory_span = market_inventory.span();
        assert(ImplMarket::is_item_available(ref market_inventory_span, ItemId::Katana), 'item should be available');
    }

    #[test]
    #[available_gas(34000000)]
    fn get_id() {
        // test lower end of u64
        let mut i: u64 = 0;
        loop {
            if (i == 999) {
                break;
            }
            // get market item id
            let item_id = ImplMarket::get_id(i);
            // assert item id is within range of items
            assert(item_id != 0 && item_id <= NUM_ITEMS, 'offset out of bounds');
            i += 1;
        };

        // test upper end of u64
        let mut i: u64 = 0xffffffffffffff0f;
        loop {
            if (i == 0xffffffffffffffff) {
                break;
            }
            // get market item id
            let item_id = ImplMarket::get_id(i);
            // assert item id is within range of items
            assert(item_id != 0 && item_id <= NUM_ITEMS, 'offset out of bounds');
            i += 1;
        };
    }

    #[test]
    #[available_gas(50000)]
    fn get_price() {
        let t1_price = ImplMarket::get_price(Tier::T1(()));
        assert(t1_price == (6 - 1) * TIER_PRICE, 't1 price');

        let t2_price = ImplMarket::get_price(Tier::T2(()));
        assert(t2_price == (6 - 2) * TIER_PRICE, 't2 price');

        let t3_price = ImplMarket::get_price(Tier::T3(()));
        assert(t3_price == (6 - 3) * TIER_PRICE, 't3 price');

        let t4_price = ImplMarket::get_price(Tier::T4(()));
        assert(t4_price == (6 - 4) * TIER_PRICE, 't4 price');

        let t5_price = ImplMarket::get_price(Tier::T5(()));
        assert(t5_price == (6 - 5) * TIER_PRICE, 't5 price');
    }

    #[test]
    #[available_gas(15500000)]
    fn get_available_items_ownership() {
        let market_seed = 12345;
        let market_size = 21;

        let inventory = @ImplMarket::get_available_items(1, market_seed, market_size);

        // iterate over the items on the market
        let mut item_count: u32 = 0;
        loop {
            if item_count == inventory.len() {
                break ();
            }

            // get item id and assert it's within range
            let item_id = *inventory.at(item_count.into());
            assert(item_id != 0 && item_id <= NUM_ITEMS, 'item id out of range');

            let mut inventory_span = inventory.span();

            // assert item is available on the market
            assert(ImplMarket::is_item_available(ref inventory_span, item_id), 'item');

            item_count += 1;
        };
    }

    #[test]
    #[available_gas(100000000)]
    fn test_get_available_items_deterministic() {
        let adventurer_id = 42;
        let seed = 98765;
        let market_size = 15;

        let items1 = ImplMarket::get_available_items(adventurer_id, seed, market_size);
        let items2 = ImplMarket::get_available_items(adventurer_id, seed, market_size);

        assert(items1.len() == items2.len(), 'lengths should match');

        let mut i = 0;
        loop {
            if i == items1.len() {
                break;
            }
            assert(*items1.at(i) == *items2.at(i), 'items should match');
            i += 1;
        };
    }

    #[test]
    #[available_gas(100000000)]
    fn test_get_available_items_different_seeds() {
        let adventurer_id = 1;
        let seed1 = 11111;
        let seed2 = 22222;
        let market_size = 20;

        let items1 = ImplMarket::get_available_items(adventurer_id, seed1, market_size);
        let items2 = ImplMarket::get_available_items(adventurer_id, seed2, market_size);

        // Count differences
        let mut differences = 0;
        let mut i = 0;
        loop {
            if i == items1.len() {
                break;
            }
            if *items1.at(i) != *items2.at(i) {
                differences += 1;
            }
            i += 1;
        };

        assert(differences != 0, 'should have differences');
    }

    #[test]
    #[available_gas(5000000000)]
    fn test_all_items_can_appear() {
        // Save all generated item IDs to an array
        let mut all_items: Array<u8> = ArrayTrait::new();
        let mut total_items_generated = 0_u32;
        let mut seed = 1_u64;
        let max_seeds = 100_u64;

        loop {
            if seed > max_seeds {
                break;
            }

            // Generate market with maximum size to increase chances of seeing all items
            let items = ImplMarket::get_available_items(seed, seed * 7919, 31);

            let mut j = 0;
            loop {
                if j == items.len() {
                    break;
                }
                let item_id = *items.at(j);
                assert!(item_id >= 1 && item_id <= NUM_ITEMS, "valid item id");

                all_items.append(item_id);
                total_items_generated += 1;

                j += 1;
            };

            seed += 1;
        };

        // Convert array to span for iteration
        let items_span = all_items.span();

        // Check that each item ID from 1 to 101 exists in the array
        let mut item_id = 1_u8;
        loop {
            if item_id > NUM_ITEMS {
                break;
            }

            let mut found = false;
            let mut i = 0;
            loop {
                if i == items_span.len() {
                    break;
                }
                if *items_span[i] == item_id {
                    found = true;
                    break;
                }
                i += 1;
            };

            assert!(found, "should see all item IDs");
            item_id += 1;
        };
    }

    #[test]
    #[available_gas(30000000000)]
    fn test_uniform_distribution() {
        let market_size = 21_u8;

        let mut total_items_generated = 0_u32;

        // Count items in different ranges
        let mut low_range_count = 0_u32; // 1-25
        let mut mid_range_count = 0_u32; // 26-75
        let mut high_range_count = 0_u32; // 76-101

        let mut seed = 1_u32;
        let statistical_trials = 1000_u32;

        loop {
            if seed > statistical_trials {
                break;
            }

            let items = ImplMarket::get_available_items(seed.into(), (seed * 17).into(), market_size);

            let mut j = 0;
            loop {
                if j == items.len() {
                    break;
                }
                let item_id = *items.at(j);
                total_items_generated += 1;

                // Count by range
                if item_id <= 25 {
                    low_range_count += 1;
                } else if item_id <= 75 {
                    mid_range_count += 1;
                } else {
                    high_range_count += 1;
                }

                j += 1;
            };

            seed += 1;
        };

        // Check distribution across ranges
        // Expected: low=25%, mid=50%, high=25% (approximately)
        let expected_low = total_items_generated / 4; // 25%
        let expected_mid = total_items_generated / 2; // 50%
        let expected_high = total_items_generated / 4; // 25%

        // Allow 5% deviation
        let tolerance_low = expected_low * 5 / 100;
        let tolerance_mid = expected_mid * 5 / 100;
        let tolerance_high = expected_high * 5 / 100;

        // Verify ranges are within tolerance
        assert(low_range_count >= expected_low - tolerance_low, 'low range too few');
        assert(low_range_count <= expected_low + tolerance_low, 'low range too many');
        assert(mid_range_count >= expected_mid - tolerance_mid, 'mid range too few');
        assert(mid_range_count <= expected_mid + tolerance_mid, 'mid range too many');
        assert(high_range_count >= expected_high - tolerance_high, 'high range too few');
        assert(high_range_count <= expected_high + tolerance_high, 'high range too many');

        // Verify total adds up
        assert(low_range_count + mid_range_count + high_range_count == total_items_generated, 'counts dont add up');
    }

    #[test]
    #[available_gas(3000000000)]
    fn test_market_size_consistency() {
        // Test: Generate 100 markets with 21 items each and verify majority have exactly 21 items
        let market_size = 21_u8;
        let num_markets = 100_u32;
        let mut markets_with_correct_size = 0_u32;
        let mut markets_above_10 = 0_u32;

        let mut seed = 1_u64;
        loop {
            if seed > num_markets.into() {
                break;
            }

            let adventurer_id = seed * 13;
            let market_seed = seed * 7919;

            let items = ImplMarket::get_available_items(adventurer_id, market_seed, market_size);

            // Check if this market has exactly the requested size
            if items.len() == market_size.into() {
                markets_with_correct_size += 1;
            }
            if items.len() > 10 {
                markets_above_10 += 1;
            }

            // Verify all items are valid (1-101)
            let mut i = 0;
            loop {
                if i == items.len() {
                    break;
                }
                let item = *items.at(i);
                assert(item >= 1 && item <= NUM_ITEMS, 'item out of range');
                i += 1;
            };

            seed += 1;
        };

        // A reasonable threshold would be at least 80% (80 out of 100)
        assert!(markets_with_correct_size >= 80, "majority should have correct size");
        assert!(markets_above_10 == 100, "All markets should be above 10");
    }
}
