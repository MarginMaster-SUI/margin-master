#!/bin/bash

# MarginMaster Integration Test Script
# This script demonstrates the complete flow from blockchain to database

PACKAGE_ID="0x5f419349ecde88dde843944880e9975ea9f7e63dcc45a602cdef2a2e9a325283"
VAULT_ID="0x3fbfd5eea2779c385eabc727241fd41ba0558182884b4f179ed65312327db7c4"
CLOCK_ID="0x6"  # Sui Clock shared object

echo "🧪 MarginMaster Integration Test"
echo "================================="
echo ""
echo "📦 Package ID: $PACKAGE_ID"
echo "🏦 Vault ID: $VAULT_ID"
echo ""

# Test 1: Open a LONG position on BTC/USDC
echo "🔵 Test 1: Opening LONG position on BTC/USDC..."
echo "Command:"
echo "sui client call \\"
echo "  --package $PACKAGE_ID \\"
echo "  --module position \\"
echo "  --function open_position_entry \\"
echo "  --type-args 0x2::sui::SUI \\"
echo "  --args $VAULT_ID \\"
echo "         \"0x4254432f55534443\" \\"  # BTC/USDC in hex
echo "         0 \\"  # LONG position
echo "         50000000000 \\"  # Entry price: $50,000
echo "         100000000 \\"  # Quantity: 0.1 BTC
echo "         5 \\"  # Leverage: 5x
echo "         1000000000 \\"  # Margin: 1 SUI
echo "         $CLOCK_ID \\"
echo "  --gas-budget 20000000"
echo ""

# Uncomment to run automatically:
# sui client call \
#   --package $PACKAGE_ID \
#   --module position \
#   --function open_position_entry \
#   --type-args 0x2::sui::SUI \
#   --args $VAULT_ID \
#          "0x4254432f55534443" \
#          0 \
#          50000000000 \
#          100000000 \
#          5 \
#          1000000000 \
#          $CLOCK_ID \
#   --gas-budget 20000000

echo "✅ Copy and run the command above to test!"
echo ""
echo "👀 Watch your event indexer logs to see:"
echo "   1. PositionOpened event detected"
echo "   2. User auto-created in database"
echo "   3. TradingPair BTC/USDC created"
echo "   4. Position saved to PostgreSQL"
echo "   5. Trade record created"
echo ""
echo "🔍 Check database:"
echo "   cd packages/backend && pnpm prisma studio"
