import { useRouter } from "expo-router";

import {
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";

import { SafeAreaView } from "react-native-safe-area-context";

import { colors } from "../../theme";

export default function AssignedCasesScreen() {
  const router = useRouter();

  const handleFilter = () => {
    Alert.alert(
      "Case filters",
      "Filtering will be connected after the case database is implemented.",
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}

      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={styles.backButton}
        >
          <Text style={styles.backText}>‹</Text>
        </Pressable>

        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Assigned Cases</Text>

          <Text style={styles.headerSubtitle}>Case Officer Workspace</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Information */}

        <View style={styles.infoCard}>
          <Text style={styles.infoLabel}>YOUR CASELOAD</Text>

          <Text style={styles.infoTitle}>Assigned investigations</Text>

          <Text style={styles.infoText}>
            Cases formally assigned to your Case Officer account will appear
            here.
          </Text>
        </View>

        {/* Search placeholder */}

        <View style={styles.controlsRow}>
          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>🔎</Text>

            <Text style={styles.searchPlaceholder}>
              Search by case ID or title
            </Text>
          </View>

          <Pressable onPress={handleFilter} style={styles.filterButton}>
            <Text style={styles.filterText}>Filter</Text>
          </Pressable>
        </View>

        {/* Filter chips */}

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
        >
          <View style={styles.activeChip}>
            <Text style={styles.activeChipText}>All</Text>
          </View>

          <View style={styles.chip}>
            <Text style={styles.chipText}>New</Text>
          </View>

          <View style={styles.chip}>
            <Text style={styles.chipText}>In progress</Text>
          </View>

          <View style={styles.chip}>
            <Text style={styles.chipText}>Awaiting evidence</Text>
          </View>

          <View style={styles.chip}>
            <Text style={styles.chipText}>Priority</Text>
          </View>
        </ScrollView>

        {/* Empty state */}

        <View style={styles.emptyCard}>
          <View style={styles.emptyIconBox}>
            <Text style={styles.emptyIcon}>📁</Text>
          </View>

          <Text style={styles.emptyTitle}>Case data not connected yet</Text>

          <Text style={styles.emptyDescription}>
            The Case Officer interface is ready. Assigned cases will appear here
            after we create the JusticeNow case and assignment database
            structure.
          </Text>

          <View style={styles.statusBox}>
            <View style={styles.statusDot} />

            <Text style={styles.statusText}>
              Officer module UI ready for backend integration
            </Text>
          </View>
        </View>

        {/* Security Note */}

        <View style={styles.securityNotice}>
          <Text style={styles.securityIcon}>🔒</Text>

          <View style={{ flex: 1 }}>
            <Text style={styles.securityTitle}>Case access is restricted</Text>

            <Text style={styles.securityText}>
              Case Officers should only be able to access cases assigned to
              them. We will enforce this in the database as well as the
              interface.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,

    backgroundColor: colors.background,
  },

  // -------------------------------------------------------
  // Header
  // -------------------------------------------------------

  header: {
    minHeight: 66,

    flexDirection: "row",
    alignItems: "center",

    paddingHorizontal: 14,

    borderBottomWidth: 1,

    borderBottomColor: colors.border,

    backgroundColor: colors.surface,
  },

  backButton: {
    width: 42,
    height: 42,

    alignItems: "center",
    justifyContent: "center",
  },

  backText: {
    fontSize: 32,

    color: colors.navy[700],
  },

  headerContent: {
    flex: 1,
  },

  headerTitle: {
    fontSize: 17,
    fontWeight: "700",

    color: colors.navy[800],
  },

  headerSubtitle: {
    marginTop: 2,

    fontSize: 11.5,

    color: colors.textSecondary,
  },

  // -------------------------------------------------------
  // Content
  // -------------------------------------------------------

  scrollContent: {
    padding: 16,

    paddingBottom: 34,
  },

  infoCard: {
    padding: 18,

    borderRadius: 16,

    backgroundColor: colors.navy[800],
  },

  infoLabel: {
    fontSize: 10.5,

    fontWeight: "700",

    letterSpacing: 0.7,

    color: "#AFC2D9",
  },

  infoTitle: {
    marginTop: 5,

    fontSize: 18,

    fontWeight: "800",

    color: colors.textInverse,
  },

  infoText: {
    marginTop: 6,

    fontSize: 12,

    lineHeight: 18,

    color: "#DCE5EF",
  },

  // -------------------------------------------------------
  // Controls
  // -------------------------------------------------------

  controlsRow: {
    flexDirection: "row",

    marginTop: 16,

    gap: 8,
  },

  searchBox: {
    flex: 1,

    minHeight: 46,

    flexDirection: "row",

    alignItems: "center",

    paddingHorizontal: 13,

    borderWidth: 1,

    borderColor: colors.border,

    borderRadius: 12,

    backgroundColor: colors.surface,
  },

  searchIcon: {
    marginRight: 8,

    fontSize: 14,
  },

  searchPlaceholder: {
    flex: 1,

    fontSize: 12.5,

    color: colors.textSoft,
  },

  filterButton: {
    minHeight: 46,

    paddingHorizontal: 15,

    alignItems: "center",
    justifyContent: "center",

    borderWidth: 1,

    borderColor: colors.royal[200],

    borderRadius: 12,

    backgroundColor: colors.royal[50],
  },

  filterText: {
    fontSize: 12,

    fontWeight: "600",

    color: colors.royal[700],
  },

  // -------------------------------------------------------
  // Filter Chips
  // -------------------------------------------------------

  filters: {
    gap: 7,

    paddingVertical: 13,
  },

  activeChip: {
    minHeight: 34,

    paddingHorizontal: 14,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 18,

    backgroundColor: colors.royal[700],
  },

  activeChipText: {
    fontSize: 11.5,

    fontWeight: "600",

    color: colors.textInverse,
  },

  chip: {
    minHeight: 34,

    paddingHorizontal: 14,

    alignItems: "center",
    justifyContent: "center",

    borderWidth: 1,

    borderColor: colors.border,

    borderRadius: 18,

    backgroundColor: colors.surface,
  },

  chipText: {
    fontSize: 11.5,

    fontWeight: "500",

    color: colors.navy[700],
  },

  // -------------------------------------------------------
  // Empty State
  // -------------------------------------------------------

  emptyCard: {
    marginTop: 10,

    padding: 24,

    alignItems: "center",

    borderWidth: 1,

    borderColor: colors.border,

    borderRadius: 16,

    backgroundColor: colors.surface,
  },

  emptyIconBox: {
    width: 60,
    height: 60,

    alignItems: "center",
    justifyContent: "center",

    borderRadius: 18,

    backgroundColor: colors.royal[50],
  },

  emptyIcon: {
    fontSize: 25,
  },

  emptyTitle: {
    marginTop: 14,

    textAlign: "center",

    fontSize: 15,

    fontWeight: "700",

    color: colors.navy[800],
  },

  emptyDescription: {
    marginTop: 7,

    textAlign: "center",

    fontSize: 12,

    lineHeight: 18,

    color: colors.textSecondary,
  },

  statusBox: {
    marginTop: 18,

    flexDirection: "row",

    alignItems: "center",

    paddingHorizontal: 12,
    paddingVertical: 9,

    borderRadius: 10,

    backgroundColor: colors.teal[50],
  },

  statusDot: {
    width: 7,
    height: 7,

    marginRight: 7,

    borderRadius: 4,

    backgroundColor: colors.success,
  },

  statusText: {
    flex: 1,

    fontSize: 10.5,

    color: colors.teal[800],
  },

  // -------------------------------------------------------
  // Security
  // -------------------------------------------------------

  securityNotice: {
    flexDirection: "row",

    marginTop: 14,

    padding: 14,

    borderWidth: 1,

    borderColor: colors.teal[100],

    borderRadius: 14,

    backgroundColor: colors.teal[50],
  },

  securityIcon: {
    marginRight: 9,

    fontSize: 15,
  },

  securityTitle: {
    fontSize: 12,

    fontWeight: "700",

    color: colors.teal[800],
  },

  securityText: {
    marginTop: 3,

    fontSize: 11,

    lineHeight: 16,

    color: colors.textSecondary,
  },
});
